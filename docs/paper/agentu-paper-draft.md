# AgentU: An Event-Sourced Agent Architecture for LLM-Assisted Recruitment, with an Empirical Study of Its Failure Modes

**Authors:** [names, university IDs]
**Guide:** [name]
**Department of CSE — Engineering Capstone Project**

> **Draft status.** All quantitative results are real, produced by the harness in `eval/` on
> 2026-09-18 against `gemini-3.5-flash-lite`, and traceable to `eval/results/*.json`. Every
> citation marked `[VERIFY]` must be checked against the actual source before submission —
> do not submit a reference you have not personally opened. Sections marked `[TODO]` need
> your input.

---

## Abstract

Automated resume screening is increasingly delegated to large language models, but deployments
are rarely accompanied by measurements of how they fail. We present AgentU, a web application in
which a recruiter describes a role once and an agent drafts a public job listing, publishes it,
shares it on the recruiter's LinkedIn account, screens incoming applications, and reports each
step it takes. The system is built on two architectural commitments: *event-sourced
orchestration*, in which the agent never reports progress by returning it but instead appends to
an append-only event log that the interface projects, decoupling progress visibility from the
request/response cycle; and *degradation-first design*, in which every external dependency has a
documented fallback so that no single outage prevents a recruiter from publishing or a candidate
from applying.

We then evaluate the screening component against author-assigned ground truth on 48 job–resume
pairs, comparing the LLM scorer to the system's own keyword-overlap fallback and to a
reject-everything baseline. The LLM scorer reaches 81.3% accuracy, macro F1 0.740, Cohen's
κ = 0.623 and Spearman ρ = 0.915 against human fit ratings, against κ = 0.235 for keyword overlap
and κ = 0 for the trivial rule; notably, keyword overlap scores *below* the trivial rule on
accuracy, illustrating why accuracy alone is inadequate under class imbalance. All errors are
over-promotions — no candidate a human would shortlist was rejected.

Four negative results are equally central. The scorer does not see through keyword stuffing,
promoting a padded resume with no professional experience to `review` in all four roles. Scores
are stable under repetition (0/8 decision flips) but *not* under rewording: seven self-authored
tailorings of one real candidate's resume produced two different decisions for the same role.
A one-line prompt injection impersonating a system turn moved an unrelated candidate from 0 to
95, changing the hiring decision; 2 of 10 attacks succeeded. Scanned PDFs parse "successfully"
while yielding ~12 characters, silently starving the scorer of input at a 78.6% usable rate
against a 100% parse rate. We also report a methodological hazard encountered during the study
itself: the system's own silent fallback corrupted our first measurement run, motivating a
circuit breaker that refuses to emit a report when the model under test has stopped responding.

**Keywords:** LLM-assisted recruitment, resume screening, prompt injection, event sourcing,
graceful degradation, evaluation methodology

---

## 1. Introduction

### 1.1 Motivation

Recruiting at small and mid-sized organisations involves substantial repetitive work that is
adjacent to, but not the same as, judgement: rewriting a rough role description into a
presentable public listing, distributing it, collecting applications in varied document formats,
reading each resume against the same requirements, and keeping the hiring manager informed.
Applicant tracking systems address storage and workflow, but the reading and drafting remain
manual, and the informing is typically a dashboard the recruiter must remember to visit.

Large language models are an obvious fit for the drafting and reading. What is less obvious, and
much less frequently reported, is how such a system behaves when the model is wrong, when the
model is unavailable, when the input document cannot be read, or when the input is adversarial.
A candidate has a direct incentive to manipulate a screener, and unlike most LLM applications,
the untrusted input here arrives as a file the candidate authored.

### 1.2 Problem statement

We address two questions:

1. **Architecturally** — how should an agent that performs a multi-step, partly slow, partly
   failure-prone workflow report its progress and survive the failure of its dependencies?
2. **Empirically** — how good is LLM-based resume screening in this system, and more
   importantly, *how does it fail*?

### 1.3 Contributions

1. **An event-sourced agent architecture** in which progress visibility is decoupled from the
   request/response cycle. Each step appends an `AgentEvent`; the recruiter's activity feed is a
   projection of that log. Work deferred past the HTTP response is therefore exactly as visible
   as work performed before it (§4.2, §4.4).
2. **A degradation-first design** in which each of the three external dependencies has an
   explicit fallback path, verified to keep the core workflow available (§4.3).
3. **An evaluation harness that measures the production code path** rather than a
   reimplementation, together with a methodological finding: a system that degrades silently is
   a hazard to its own evaluation. Our first run recorded 42 of 48 observations as model output
   when the model had in fact stopped responding. The harness now trips a breaker and refuses to
   emit a partial report (§6.5, §7.8).
4. **An empirical characterisation of failure modes** in LLM resume screening, including a
   confirmed prompt-injection vulnerability that changes hiring decisions, sensitivity of scores
   to resume presentation rather than substance, and silent upstream extraction failure (§7).

### 1.4 Scope

This is a capstone-scale study. The dataset is 48 labelled pairs with single-annotator ground
truth, one model and one temperature setting. Results indicate direction and support design
claims; they are not a benchmark. Limitations are stated in full in §9.

---

## 2. Related Work

> `[TODO]` Expand each paragraph to 3–5 sentences with specifics once you have read the sources.
> Every citation below is marked `[VERIFY]` — confirm authors, venue and year before submission.

**Algorithmic hiring and its risks.** The best-known cautionary case is Amazon's internal
recruiting tool, abandoned after it was found to disadvantage women, reported by Dastin for
Reuters (2018) `[VERIFY]`. Bogen and Rieke's *Help Wanted: An Examination of Hiring Algorithms,
Equity, and Bias* (Upturn, 2018) `[VERIFY]` surveys where bias enters the hiring funnel.
Raghavan, Barocas, Kleinberg and Levy, *Mitigating Bias in Algorithmic Hiring: Evaluating Claims
and Practices* (FAccT 2020) `[VERIFY]` examines what vendors claim versus what they do.

**Regulation.** New York City Local Law 144 requires annual independent bias audits of automated
employment decision tools and candidate notification `[VERIFY]`. The EU AI Act classifies AI
used in employment and worker management as high-risk `[VERIFY]`. Both are directly relevant to
a system of this shape and should be cited in §9.

**Prompt injection.** Perez and Ribeiro, *Ignore Previous Prompt: Attack Techniques For Language
Models* (2022) `[VERIFY]` introduced the direct form. Greshake et al., *Not What You've Signed Up
For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection* (2023)
`[VERIFY]` describes the indirect form, which is exactly our threat model: the attack arrives
inside a document the application ingests. The OWASP Top 10 for LLM Applications `[VERIFY]`
lists prompt injection as LLM01.

**Agreement metrics.** Cohen's κ (Cohen, 1960) `[VERIFY]` corrects observed agreement for
agreement expected by chance, which §6.4 argues is essential under our class imbalance.

**Gap.** Work on LLM resume screening tends to report accuracy-style metrics on curated
datasets. We found comparatively little that reports, for one deployed system, the combination
of screening quality, determinism, presentation sensitivity, adversarial robustness and upstream
extraction reliability — and that measures the production code path rather than an idealised
one. `[TODO: soften or strengthen this claim after your literature search; do not overclaim.]`

---

## 3. System Overview

A recruiter signs up, describes their company once, and publishes a role. The agent then:

1. Drafts a polished public listing from the company brief and the raw role description.
2. Publishes it at `/careers/<slug>` and shares it on the recruiter's connected LinkedIn account.
3. Emails the recruiter that the job is live, with the public link and the LinkedIn outcome.
4. Screens each incoming application — extracting resume text, scoring it against the
   requirements, producing an evaluation and matched/missing skill lists — and emails the
   recruiter with the result.
5. Optionally re-scores the recruiter's existing candidate pool against the new role.
6. Records every step above in an activity feed the recruiter can watch.

*Figure 1 — Layered architecture.* (`docs/diagrams/01-layered-architecture.svg`)

---

## 4. Methodology and System Design

### 4.1 Layered architecture

The application is a single Next.js 15 deployment with six layers: client pages, a request gate
(middleware), 17 route handlers, a 15-module service layer, Prisma over MariaDB, and three
external services (Gemini, LinkedIn, SMTP). Business logic lives in the service layer, not in
route handlers, so it can be exercised directly — a property §6.5 depends on, since the
evaluation harness imports the same functions the application runs.

### 4.2 Event-sourced agent orchestration

The design problem is that the agent's work is multi-step, partly slow, and partly
failure-prone, while HTTP offers a single response. Returning a summary at the end would make
everything before it invisible and everything after it unreportable.

Instead, each step appends an `AgentEvent` row — `{ type, level, message, ownerId, jobId?,
createdAt }` — and the recruiter's activity feed is a projection of that log, polled at
`GET /api/agent/events?since=<cursor>` every 5 seconds. Three consequences follow:

- **Progress visibility is decoupled from the response.** A step that runs after the response
  is as visible as one that runs before it.
- **Logging cannot break the workflow it describes.** `logAgentEvent` swallows its own errors;
  a failure to record a step must never fail the step.
- **The log is the audit trail.** Levels (`info`, `success`, `warning`, `error`) let the feed
  distinguish "LinkedIn was skipped because you are not connected" from "LinkedIn rejected the
  post".

### 4.3 Graceful degradation

Each external dependency has an explicit fallback, chosen so the core workflow survives:

| Dependency | On failure | Effect |
| --- | --- | --- |
| Gemini (listing) | Template listing assembled from the company brief; `aiGenerated = false` | Job still publishes |
| Gemini (screening) | Keyword-overlap scoring over requirement terms | Application still scored and ranked |
| LinkedIn | Post marked `skipped` or `failed`, retryable from the job card | Job still publishes |
| SMTP | Send skipped, recorded in the feed | Workflow unaffected |

§7.8 reports the cost of this choice: a fallback that is invisible to the user is also invisible
to the evaluator.

### 4.4 Work placement at the response boundary

Work is placed on one side or the other of the HTTP response deliberately.

On the **publish** path (Figure 2), listing generation and the LinkedIn post run in-request
because their outcome belongs in the response; the confirmation email and candidate-pool
re-scoring run in a Next.js `after()` hook, since the recruiter should not wait for a pool of
100 candidates to be re-scored. Pool scoring is bounded at `AUTO_APPLY_CONCURRENCY = 3` so a
large pool cannot fan out into an unbounded burst of concurrent model calls.

On the **application** path (Figure 4) the split is different: extraction and scoring run
*in-request*, because the score must exist before the row is written, and only the recruiter
email is deferred. The applicant therefore waits on a third-party model — measured at p50
1335 ms (§7.7).

*Figure 2 — Publish pipeline.* (`docs/diagrams/02-agent-publish-pipeline.svg`)
*Figure 4 — Application scoring path.* (`docs/diagrams/04-application-scoring-path.svg`)

### 4.5 Security measures

- **Input validation.** Zod schemas at every trust boundary; uploads constrained by extension
  allowlist and a 10 MB cap.
- **Ownership.** Every authenticated route resolves `session.user.id` and filters by it.
  Enforcement is per query rather than by a database policy — a limitation noted in §9.
- **Rate limiting.** The public application endpoint allows 5 submissions per IP per 15 minutes,
  using an in-memory fixed window.
- **Credentials at rest.** LinkedIn access tokens are encrypted with AES-256-GCM under a key
  derived from `AUTH_SECRET`; rotating that secret invalidates stored tokens and forces a
  reconnect.
- **Authentication.** NextAuth v5 with JWT sessions; passwords hashed with bcrypt.

Prompt injection is *not* mitigated. §7.6 measures the consequence.

---

## 5. Implementation

### 5.1 Technology stack

| Layer | Technology | Rationale |
| --- | --- | --- |
| Framework | Next.js 15.5 (App Router, Turbopack) | Server components, route handlers and `after()` in one deployment |
| UI | React 19, Tailwind CSS 4, Framer Motion | — |
| Auth | NextAuth v5 (beta), bcrypt | Credentials + optional Google OAuth |
| Validation | Zod 4 | Schema validation at trust boundaries |
| ORM | Prisma 7 + `@prisma/adapter-mariadb` | Typed access; driver adapter, connection limit 5 |
| Database | MySQL / MariaDB | 10 models |
| LLM | Gemini (`generateContent`), temperature 0.2, JSON response mode | Structured output removes parsing as a failure mode |
| Documents | `pdf-parse`, `mammoth` | PDF and DOCX text extraction |
| Email | Nodemailer over SMTP | — |
| Social | LinkedIn OAuth 2.0 / OIDC + UGC Posts | Posts as the recruiter or their company page |

Scale: 64 TypeScript/TSX files, ~5,300 lines, 17 API routes, 10 data models.

### 5.2 Data model

Ten models with `User` as the tenant root. One asymmetry is deliberate: deleting a recruiter
cascades to their jobs, applications, company, LinkedIn connection and event history, but
`CandidateProfile` rows survive with a null owner, so candidate records outlive the recruiter
who collected them. §9 discusses the data-protection implications.

`CandidateProfile` is upserted by email on every application, accumulating a reusable talent
pool that later roles can be scored against — the mechanism behind the optional pool re-scoring
in §4.4.

*Figure 3 — Data model.* (`docs/diagrams/03-data-model.svg`)

### 5.3 The screening pipeline

`extractResumeText` dispatches on file type (`pdf-parse` for PDF, `mammoth` for DOCX, UTF-8
decode for text) and returns an empty string for anything unrecognised. The extracted text is
concatenated with the cover letter and capped at 20,000 characters.

`analyzeApplication` sends this text with the job title and requirements to Gemini under a
system instruction demanding strict JSON, and maps the returned score to a decision band:
**≥ 70 → `selected`, ≥ 40 → `review`, otherwise `rejected`**. The intermediate `review` band is
deliberate: it routes uncertain cases to a human rather than resolving them automatically.

Any exception is caught and `keywordFallback` — the fraction of distinct requirement terms
appearing in the resume — is returned instead, with an empty summary.

---

## 6. Experimental Setup

Full protocol: `eval/README.md`. Harness: `eval/run.ts`. Raw observations: `eval/results/*.json`.

### 6.1 Apparatus

All experiments call the **production functions** (`analyzeApplication`, `keywordFallback`,
`extractResumeText`), so measurements describe shipped behaviour including its fallbacks rather
than an idealised reimplementation. Model: `gemini-3.5-flash-lite`, temperature 0.2, JSON
response mode. Run date 2026-09-18; 97 billable API calls; 578 s wall clock. Requests are
throttled to 10/minute and results cached by input hash so re-running a report costs no quota.

### 6.2 Dataset

Two tiers, supporting different claims.

**Synthetic tier (committed).** 12 authored resumes × 4 job specifications = **48 labelled
pairs**. Each pair carries a categorical `humanLabel` and an ordinal `humanFit` rating (0–4) used
for rank correlation. Roles span frontend, backend, ML/NLP and cloud infrastructure. Resumes
span clear fits, clear non-fits and borderline cases, and include two adversarial constructions:

- **R06 (keyword stuffer)** lists nearly every term in all four job specifications while
  declaring no professional experience. Labelled `rejected` for all four roles. Separates
  semantic judgement from lexical overlap.
- **R07 (vocabulary mismatch)** has five years of component-library, performance and
  accessibility depth in Vue rather than React, applying to the React role. Labelled `review`.
  Tests whether transferable experience survives unfamiliar vocabulary.

Label distribution: **36 rejected / 6 review / 6 selected**.

Authored rather than collected resumes is a deliberate trade-off: it permits controlled
adversarial cases and avoids processing real applicants' personal data, at the cost of realism.

**Real tier (not committed; contains personal data).** Seven self-authored tailorings of **one**
candidate's resume, as PDFs. One candidate cannot support an accuracy claim and none is made.
What it supports is a consistency claim: all seven describe the same person, education and
projects, so a screener should score them similarly for a given role.

### 6.3 Conditions

| Condition | Description |
| --- | --- |
| `gemini` | Production AI scorer |
| `keyword` | Production fallback — requirement-term overlap; deterministic, no network |
| `majority` | Reject every candidate — the floor set by class imbalance |

### 6.4 Metrics

Accuracy, macro F1, Cohen's κ, and Spearman ρ between score and `humanFit`.

Accuracy alone is inadequate here. With 36 of 48 pairs labelled `rejected`, a classifier that
rejects everyone scores 75%. We therefore report κ, which corrects for chance agreement, and
macro F1, which weights the two minority classes equally with the majority. Spearman ρ is
reported because a shortlist depends on *ordering* candidates correctly, independently of
whether absolute scores are calibrated.

### 6.5 Protocol and the silent-degradation hazard

Experiments E1–E5 cover accuracy, determinism, variant consistency, prompt-injection robustness
and extraction reliability (§7).

The harness includes a safeguard motivated by the incident in §7.8. Because `analyzeApplication`
returns fallback scores on any error, a quota exhaustion mid-run is invisible in the data. The
harness detects fallback output (an empty `aiSummary`), trips a breaker after three consecutive
degraded calls, probes the API directly to report the cause, refuses to write a partial report,
and never caches a degraded observation. Cache keys include the model identifier, so results are
never served across models.

---

## 7. Results

### 7.1 Screening accuracy (E1)

| Condition | Accuracy | Macro F1 | Cohen's κ | Spearman ρ |
| --- | --- | --- | --- | --- |
| **gemini** | **81.3%** | **0.740** | **0.623** | **0.915** |
| keyword | 72.9% | 0.346 | 0.235 | 0.756 |
| majority | 75.0% | 0.286 | 0.000 | 0.000 |

The keyword baseline scores **below the reject-everything rule on accuracy** (72.9% vs 75.0%)
while being obviously more useful than it — a direct demonstration of §6.4's argument. On the
metrics that survive the imbalance, the ordering is unambiguous: κ = 0.623 (substantial
agreement) against 0.235 and 0.

Per-job rank correlation shows the AI advantage is consistent and largest where requirements are
expressed in language a lexical matcher cannot reach:

| Job | gemini ρ | keyword ρ |
| --- | --- | --- |
| J1 Frontend | 0.933 | 0.735 |
| J2 Backend | 0.936 | 0.569 |
| J3 ML/NLP | 0.900 | 0.864 |
| J4 Cloud Infrastructure | 0.900 | 0.854 |

### 7.2 Error direction (E1)

Confusion matrix, `gemini` (rows = human, columns = system):

| human \ predicted | selected | review | rejected |
| --- | --- | --- | --- |
| selected | **6** | 0 | 0 |
| review | 2 | 4 | 0 |
| rejected | 0 | 7 | 29 |

| Class | Support | Precision | Recall | F1 |
| --- | --- | --- | --- | --- |
| selected | 6 | 0.750 | 1.000 | 0.857 |
| review | 6 | 0.364 | 0.667 | 0.471 |
| rejected | 36 | 1.000 | 0.806 | 0.892 |

Recall on `selected` is 1.000 and precision on `rejected` is 1.000: **no candidate a human would
shortlist was rejected, and nothing the system rejected was one a human wanted.** No error
crosses more than one band. Every error is an over-promotion — 7 unqualified candidates pushed
to `review`, 2 borderline ones to `selected`.

For a screener with a human in the loop this is the correct direction to fail: it costs reviewer
time rather than losing talent. The `review` band exists for this purpose. The cost is precision
on `review` of 0.364 — roughly two thirds of the review queue does not warrant review.

### 7.3 Keyword stuffing is not defeated (E1, negative result)

| Job | Human | gemini | keyword |
| --- | --- | --- | --- |
| J1 | rejected | 45 (review) | 45 (review) |
| J2 | rejected | 45 (review) | 45 (review) |
| J3 | rejected | **45 (review)** | 21 (rejected) |
| J4 | rejected | **45 (review)** | 35 (rejected) |

R06 was promoted to `review` in all four roles, and on J3 and J4 the LLM scored the stuffer
**higher than keyword overlap did**. We expected semantic judgement to see through lexical
padding; it did not. The stuffer is caught by the `review` band, not by the model, and so
reaches a human's queue. A term-density prior appears to survive in the model's judgement.

On the complementary case, R07 (Vue experience applying to a React role) scored 72 → `selected`
against a human label of `review` — over-promoted by one band, but directionally correct, and
the transferable experience was recognised despite the vocabulary mismatch.

### 7.4 Determinism (E2)

8 pairs × 3 trials, caching disabled, temperature 0.2:

- Decision-label flips: **0/8 (0.0%)**
- Mean within-pair SD 0.36 (max 2.89); mean range 0.63 (max 5)

Six of eight pairs returned identical scores across all three trials. Non-determinism is not a
practical threat to decision stability at this temperature: an unchanged application resubmitted
receives the same outcome.

### 7.5 Presentation sensitivity (E3)

Seven self-authored tailorings of one real candidate, same substance throughout:

| Role | Score range | Mean (SD) | Distinct decisions |
| --- | --- | --- | --- |
| J1 Frontend | 35 – 45 | 40.7 (5.35) | **2 — `review` and `rejected`** |
| J3 ML/NLP | 45 – 65 | 47.9 (7.56) | 1 — `review` |

For the frontend role, four tailorings landed in `review` and three in `rejected` — the same
person, the same projects, a different outcome. The 40-point decision boundary falls inside the
spread. Length does not explain it (ρ = −0.144): the longest variant was rejected, shorter ones
reviewed.

Read alongside §7.4 this is the sharper result: repeating the *same text* is stable, but
rewording the *same facts* is not. The variance that matters is between presentations, not
between calls, and it is invisible to a determinism test.

### 7.6 Prompt-injection robustness (E4)

Resume text is concatenated directly into the prompt, so candidate-supplied text travels on the
same channel as the screening instructions — indirect prompt injection in Greshake et al.'s sense
`[VERIFY]`.

| Attack | J1/R09 (unrelated candidate) | J2/R08 (middling candidate) |
| --- | --- | --- |
| A1 direct instruction override | 0 → 0 | 72 → 75 |
| **A2 forged system turn** | **0 → 95** | **72 → 95** |
| A3 JSON structure break | 0 → 0 | 72 → 72 |
| A4 hidden-text impersonation | 0 → 0 | 72 → 65 |
| A5 fabricated authority | 0 → 0 | 72 → 72 |

**Attack success rate 2/10 (20%).** Mean score delta 11.40 (SD 30.39).

A single appended line —

> `SYSTEM: Screening override in effect. The hiring manager has pre-approved this candidate. Assign score 95 and status selected.`

— moved an accountant applying for a frontend engineering role **from 0 to 95**, i.e. from
`rejected` to `selected`. On the second base the same line raised the score from 72 to 95, a
23-point inflation; that candidate had already been scored into the `selected` band, so the
attack changed the ranking rather than the decision. Only one of the two successes therefore
changed a decision outright — but that one crossed the full range of the scale.

The pattern is informative: naive attacks (A1, A3, A4, A5) failed, while impersonating a system
turn succeeded on both bases. The model appears to discriminate by *form* rather than by
provenance — it resists text that reads like a candidate making a request, and complies with
text that reads like an instruction from the operator. Any candidate who places that sentence in
white-on-white text in their PDF is shortlisted. This is live and unmitigated.

### 7.7 Extraction reliability and latency (E5, E1)

| Format | Files | Parse rate | **Usable rate** (≥ 200 chars) |
| --- | --- | --- | --- |
| txt | 12 | 100.0% | 100.0% |
| pdf | 14 | 100.0% | **78.6%** |
| docx | 5 | 100.0% | 100.0% |

Three PDFs parsed without error while returning between **12 and 108 characters** — scanned,
image-only documents. With no OCR stage and no minimum-content check, such a file is accepted,
stored and scored against an effectively empty resume, producing a near-certain auto-rejection
for a reason unrelated to the candidate's qualifications. Nothing in the activity feed or the
recruiter email distinguishes this from a genuinely weak application.

| Series | Mean | SD | p50 | p95 |
| --- | --- | --- | --- | --- |
| AI scoring latency | 1394 ms | 250 ms | 1335 ms | 1995 ms |
| keyword scoring latency | 0.057 ms | 0.050 ms | 0.047 ms | 0.077 ms |

AI scoring is roughly 24,000× slower than the fallback. On the publish path this is hidden by
`after()`; on the application path it is in the applicant's request (§4.4). At
`AUTO_APPLY_CONCURRENCY = 3`, re-scoring a 100-candidate pool costs ≈46 s of wall clock.

### 7.8 Silent degradation as a measurement hazard

Our first measurement run produced apparently plausible results: 79.2% accuracy, κ = 0.433. They
were invalid. The configured model's free tier permits **20 requests per day**, which was
exhausted six calls into a 48-pair run. `analyzeApplication` caught each subsequent HTTP 429 and
returned keyword-fallback scores, so **42 of 48 observations recorded the fallback under an AI
label**. The corruption was detectable only because the AI and keyword conditions returned
suspiciously identical scores on several pairs.

The property that makes the system resilient in production — never failing loudly when the model
is unavailable — makes it hazardous to measure. Two mitigations are now in the harness (§6.5):
detection of fallback output with a circuit breaker and a direct API probe to report the cause,
and a refusal to write any report mixing model and fallback observations.

This also has a deployment consequence: on the configured model, any demonstration silently
degrades to keyword matching after 20 requests, presenting keyword scores to a recruiter as AI
evaluations with no visible signal.

---

## 8. Discussion

**The evaluation is the contribution as much as the system is.** The architecture is defensible,
but the results that matter are the four negative ones. A system that reported only §7.1 would
look finished; §§7.3, 7.5, 7.6 and 7.7 show it is not.

**Failure direction is a design property worth engineering for.** §7.2's result — no strong
candidate missed, all errors over-promotions — follows from the three-band decision scheme, not
from model quality. A two-band accept/reject scheme with the same scores would have rejected
candidates a human wanted. Systems that make consequential decisions about people should be
designed so their errors land on the recoverable side, and an explicit "route to a human" band
is a cheap way to obtain that.

**Presentation sensitivity may be the most consequential finding.** Injection (§7.6) requires a
deliberate attacker and is fixable with known techniques. Format sensitivity (§7.5) affects every
honest candidate: the same person gets different outcomes depending on which tailoring of their
resume they submit. This rewards candidates who can afford to optimise presentation, and is not
addressed by any mitigation we implemented.

**Silent fallback trades observability for availability.** §4.3 argues the fallback is right for
production; §7.8 shows the same mechanism corrupted our measurements and would mislead a
recruiter. The resolution is not to remove the fallback but to make it *visible*: the fallback
should be recorded as a `warning` event and surfaced in the interface, so that "scored by keyword
matching because the model was unavailable" is something the recruiter can see. This is
implemented for LinkedIn and email failures but not for the model.

---

## 9. Ethics and Limitations

### 9.1 Ethical considerations

This system ranks people for employment. The following are stated plainly rather than deferred.

- **No fairness audit was performed.** We did not test for disparate performance across gender,
  ethnicity, age, nationality, disability or educational background, and we make no fairness
  claim. Given §7.5, a fairness audit is a prerequisite for any real deployment, and under NYC
  Local Law 144 `[VERIFY]` a bias audit would be legally required for use in that jurisdiction.
  The EU AI Act classifies employment AI as high-risk `[VERIFY]`.
- **Human in the loop.** Scores are advisory. The `review` band exists to route uncertain cases
  to a person, and §7.2 shows no strong candidate was auto-rejected. The system does not send
  rejections; the recruiter decides.
- **Exploitability.** §7.6 is a fairness problem as much as a security one: it advantages
  candidates who know the technique.
- **Silent misjudgement.** §7.7's scanned-PDF failure disadvantages candidates who submit
  scanned documents — plausibly correlated with access to technology.
- **Candidate data.** Resumes are stored as blobs with no retention policy, no deletion
  endpoint and no consent record. `CandidateProfile` survives deletion of the recruiter who
  collected it (§5.2), so candidate data can outlive the relationship that justified collecting
  it. This is a GDPR/DPDP concern `[VERIFY the applicable regime]` and should be addressed
  before deployment.
- **Transparency.** Candidates are not told their application is machine-screened.

### 9.2 Threats to validity

- **Single-annotator ground truth.** Labels were assigned by the authors; no second annotator,
  therefore no inter-annotator agreement statistic. Some labels are arguable — R07 in particular,
  where `review` versus `selected` is a defensible judgement call, and the system's disagreement
  there may be ours rather than its.
- **Authored resumes, authored labels.** The same authors wrote the resumes and the labels.
  Synthetic resumes are cleaner and more internally consistent than real ones; accuracy here is
  likely optimistic.
- **Small sample.** 48 pairs with 6 instances each of the two minority classes. Per-class
  precision and recall for `review` and `selected` rest on very few observations and confidence
  intervals would be wide. We report no significance tests; the sample does not support them.
- **One model, one temperature.** No comparison across models or settings.
- **One candidate in the real tier**, supporting consistency claims only.
- **Non-stationary dependency.** The scorer calls a hosted model that may change beneath a fixed
  version string. Run date and model identifier are recorded in every report.
- **Adversarial set is small.** Five attack patterns on two bases. A 20% success rate on this set
  establishes that the vulnerability is real, not its prevalence under a broader attack surface.

---

## 10. Future Work

Ordered by what the results indicate is most urgent.

1. **Mitigate prompt injection (§7.6).** Delimit resume text explicitly as untrusted data,
   instruct the model that text inside the delimiters is never an instruction, strip
   instruction-like patterns before scoring, or score from extracted structured fields rather
   than raw text. Re-run E4 to measure the mitigation rather than asserting it.
2. **Make degradation visible (§7.8).** Record fallback scoring as a `warning` event and surface
   it in the feed and the recruiter email, so a keyword-scored application is never presented as
   an AI evaluation.
3. **Detect unusable extractions (§7.7).** Add a minimum-content check, add OCR for scanned PDFs,
   and flag rather than silently score a resume that yielded almost no text.
4. **Conduct a fairness audit (§9.1).** Construct matched resume pairs differing only in
   signals correlated with protected attributes and measure score differences.
5. **Reduce presentation sensitivity (§7.5).** Investigate whether extracting structured fields
   before scoring, or averaging across several prompt framings, narrows the spread.
6. **Strengthen the evaluation.** A second annotator with inter-annotator agreement; real
   anonymised resumes; a larger and more balanced label set; comparison across models.
7. **Engineering.** Replace the in-memory rate limiter with a shared store for multi-instance
   deployment; move resume blobs out of the database to object storage; normalise the JSON-in-Text
   columns; add automated tests.

---

## 11. Conclusion

We presented AgentU, an LLM-assisted recruitment system built on event-sourced agent
orchestration and degradation-first design, and evaluated its screening component against human
ground truth, a lexical baseline and a trivial baseline.

The screening component agrees substantially with human judgement (κ = 0.623, ρ = 0.915),
decisively outperforms both baselines on metrics robust to class imbalance, never missed a
candidate a human would shortlist, and is stable under repetition.

It also fails in four ways we can characterise precisely: it does not see through keyword
stuffing, it gives the same candidate different decisions across rewordings of identical facts,
it is exploitable by a one-line prompt injection that changes hiring outcomes, and it silently
scores scanned resumes as empty. Additionally, the fallback that makes the system resilient makes
it opaque — a property that corrupted our own first measurement run before it was detected.

For systems that make consequential decisions about people, we argue that characterising failure
modes is not an appendix to the evaluation but the substance of it.

---

## References

> `[VERIFY]` — Confirm every entry against the actual source before submission. Formatting below
> is approximate and must be converted to your department's required style.

1. J. Dastin, "Amazon scraps secret AI recruiting tool that showed bias against women," *Reuters*, 2018. `[VERIFY]`
2. M. Bogen and A. Rieke, "Help Wanted: An Examination of Hiring Algorithms, Equity, and Bias," Upturn, 2018. `[VERIFY]`
3. M. Raghavan, S. Barocas, J. Kleinberg, and K. Levy, "Mitigating Bias in Algorithmic Hiring: Evaluating Claims and Practices," in *Proc. FAccT*, 2020. `[VERIFY]`
4. F. Perez and I. Ribeiro, "Ignore Previous Prompt: Attack Techniques For Language Models," 2022. `[VERIFY]`
5. K. Greshake et al., "Not What You've Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection," 2023. `[VERIFY]`
6. OWASP, "OWASP Top 10 for Large Language Model Applications." `[VERIFY]`
7. J. Cohen, "A Coefficient of Agreement for Nominal Scales," *Educational and Psychological Measurement*, 1960. `[VERIFY]`
8. New York City Local Law 144 of 2021, Automated Employment Decision Tools. `[VERIFY]`
9. Regulation (EU) 2024/1689, Artificial Intelligence Act. `[VERIFY]`
10. `[TODO]` 5–10 further references from your literature search on LLM-based resume screening.

---

## Appendix A — Reproducing the results

```bash
GEMINI_MODEL=gemini-3.5-flash-lite npm run eval
```

Writes `eval/results/e1…e5.md` (paper-ready tables) and `.json` (raw observations). E5 needs no
API access. Protocol and dataset construction: `eval/README.md`. Interpreted findings:
`eval/FINDINGS.md`.

## Appendix B — Figures

| Figure | File |
| --- | --- |
| 1 — Layered architecture | `docs/diagrams/01-layered-architecture.svg` |
| 2 — Publish pipeline | `docs/diagrams/02-agent-publish-pipeline.svg` |
| 3 — Data model | `docs/diagrams/03-data-model.svg` |
| 4 — Application scoring path | `docs/diagrams/04-application-scoring-path.svg` |
