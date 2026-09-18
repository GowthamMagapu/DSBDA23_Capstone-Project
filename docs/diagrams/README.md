# Architecture Diagrams

Four hand-authored SVGs, each with a PNG rendered at ~3600px wide for slides.

- **SVG** — PowerPoint (2016+) and Keynote import these natively and they stay sharp at any zoom.
- **PNG** — use these for Google Slides, which cannot import SVG.

Every diagram was drawn from the code, not from intent. Where the implementation differs from
what the README describes, the diagram follows the implementation.

| # | File | What it shows | Use it to answer |
| --- | --- | --- | --- |
| 1 | `01-layered-architecture` | Six layers from browser to database, plus the three external services and the fallback each one has | "What is the system made of?" |
| 2 | `02-agent-publish-pipeline` | The publish flow as a sequence, split at the HTTP response boundary | "What does the agent actually do, and in what order?" |
| 3 | `03-data-model` | All 10 Prisma models with cardinality and `onDelete` on every edge | "How is the data organised?" |
| 4 | `04-application-scoring-path` | The public application flow, annotated with three measured weaknesses | "Where do your evaluation findings live in the code?" |

## The claim each diagram supports

**1 — Layered architecture.** The bottom band is the one to talk to: every external dependency
has a documented fallback, so no single outage stops a recruiter publishing or a candidate
applying. That is a design property, not an accident.

**2 — Publish pipeline.** The orange boundary line is the slide's whole argument. Work the
recruiter must wait for runs in-request; email and candidate-pool re-scoring run in a Next.js
`after()` hook. Progress is never *returned* — each step appends to an append-only `AgentEvent`
log, and the dashboard feed is a projection of that log polled every 5 s, so a step that runs
after the response is as visible as one that runs before it.

**3 — Data model.** `User` is the tenant root, and ownership is enforced per query rather than
by a database policy — worth stating before an examiner asks. The one asymmetry is deliberate:
deleting a recruiter cascades to their jobs, applications and events, but `CandidateProfile`
rows survive with a null owner, so candidate records outlive the recruiter who collected them.

**4 — Application scoring path.** The counterpart to diagram 2, and the flow the evaluation
measured. Unlike publishing, the Gemini call sits *inside* the request, so the applicant waits
on it (p50 1335 ms). The three red callouts are findings F6, F7 and F8 from `eval/FINDINGS.md`,
placed at the exact line where each one occurs.

## Two details that differ from the project README

Both are drawn as the code behaves, so check the diagram rather than the prose:

1. The activity feed is **polled** — `GET /api/agent/events?since=<cursor>` every 5 s, 40 rows
   max. It is not server-sent events or streaming.
2. On the application path the AI scoring call is **not** deferred. Only the recruiter email
   runs in `after()`; extraction and scoring block the response.

## Regenerating

Edit the SVG (plain XML, no build step), then re-render the PNGs:

```bash
node -e "const s=require('sharp'),f=require('fs'),p=require('path');const d='docs/diagrams';(async()=>{for(const x of f.readdirSync(d).filter(x=>x.endsWith('.svg')))await s(p.join(d,x),{density:200}).png().toFile(p.join(d,x.replace('.svg','.png')))})()"
```

SVG text does not wrap, so a line that grows past the `viewBox` width is silently clipped.
After editing any label, re-render and check the PNG.
