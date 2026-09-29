# IEEE conference version of the paper

`main.tex` is the paper draft (`docs/paper/agentu-paper-draft.md`) typeset in the
IEEEtran conference template. It is a **single self-contained file** — no images, no
other uploads.

## Using it on Overleaf

1. New Project → Blank Project, then paste `main.tex` over the default content.
   (Or New Project → Upload Project with just `main.tex`.)
2. Set the compiler to **pdfLaTeX** (Menu → Compiler). IEEEtran does not need XeLaTeX.
3. `IEEEtran.cls` ships with Overleaf, so nothing else has to be installed.

## Before you submit

- **Add author emails.** The three authors are set (M G K Gowtham, V Balaji Vaddi,
  D Hemanth Raj); each block still has an `email@domain` placeholder to replace with an
  email address or ORCID.
- **Verify every reference.** The nine entries in `thebibliography` carry the venues and
  years the draft recorded, but the draft marks all of them `[VERIFY]`. Open each source
  and confirm authors, venue, year and page numbers before submitting.
- **Check the page count** against your target venue's limit. Twelve tables is a lot; the
  per-job correlation, keyword-stuffing and latency tables are the first things to cut.
- **Update the acknowledgment** with your guide's name.

## Figures

This version has **no figures**. The architecture diagrams live in `docs/diagrams/` and
are used in the PRC-II slide deck instead.

To add one back, upload the PNG to the Overleaf project and insert:

```latex
\begin{figure*}[!t]
\centerline{\includegraphics[width=\textwidth]{fig1.png}}
\caption{Layered architecture.}
\label{fig:arch}
\end{figure*}
```

`graphicx` is already loaded in the preamble, so nothing else is needed. Reference it in
the text with `Fig.~\ref{fig:arch}`. If a venue requires vector art, convert the SVGs to
PDF first — `graphicx` under pdfLaTeX does not read SVG.

## What changed from the Markdown draft

- Greek letters and mathematical symbols are removed from the title and abstract, as the
  IEEE template requires. Cohen's kappa and Spearman's rho are spelled out in the abstract
  and written as `$\kappa$` / `$\rho$` in the body.
- Section cross-references use `\ref{}` against labels rather than the draft's `§` numbers.
- Product and vendor names are generalised in places where the claim does not depend on the
  specific vendor.
- The draft's `[TODO]` and `[VERIFY]` markers are removed from the rendered text; the
  verification reminder survives as a LaTeX comment above the bibliography.
