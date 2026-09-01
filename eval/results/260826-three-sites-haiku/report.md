<!-- Run record for the docslice retrieval eval; see eval/README.md. -->
**Date:** 2026-08-26
**Matrix:** 3 sites (15 questions) x claude-haiku x [cold, raw-fetch, docslice] = 45 cells (44 graded; one raw-fetch asker returned no structured output)
**Arms:** both retrieval arms start from the site root only - the question's source page is never given
**Tier -> model that day:** haiku = claude-haiku-4-5-20251001; evaluator (sonnet) = claude-sonnet-5
**Cost:** 91 agent calls, ~3.07M subagent tokens, 6m11s wall clock
**Workflow run id:** wf_966096a6-0b5

## Token cost per question (harvested from run metadata)

Whole-asker-agent tokens; the cold arm is the no-retrieval baseline, so the last
column is what retrieval itself cost.

| Arm | Mean asker tokens | Retrieval tokens (minus cold baseline) |
|---|---|---|
| cold | 22,298 | 0 |
| raw-fetch | 50,462 | 28,164 |
| docslice | 29,142 | 6,844 |

docslice matched raw-fetch's accuracy (1.73 vs 1.79, within single-grader noise)
using ~4.1x fewer retrieval tokens and half the tool calls - consistent with the
deterministic Layer 1 measurement (sections 4.4x smaller than pages, see
context-cost.tsv).

---

# Docslice retrieval eval — claude-haiku, 2026-08-26

## Headline

Both retrieval arms beat cold decisively; docslice and raw-fetch are effectively tied on accuracy. Mean scores (0–2 scale): raw-fetch 1.79, docslice 1.73, cold 0.00. The cold arm answered nothing — all 15 cells were admitted unknowns, so retrieval provides all of the signal here. Docslice matched raw-fetch's accuracy at roughly half the tool-call cost: 6.5 mean tool calls per question versus 12. On raw counts, docslice got 13/15 correct and raw-fetch 12/14 correct with 1 partial. Note the raw-fetch arm has only 14 cells (the `gcov-hdf5-path` cell is missing from its results), so the arm means are not computed over identical question sets.

## Results by arm

| Arm | Cells | Correct | Partial | Wrong | Unknowns | Mean score | Mean tool calls |
|---|---|---|---|---|---|---|---|
| cold | 15 | 0 | 0 | 15 | 15 | 0.00 | 0.0 |
| raw-fetch | 14 | 12 | 1 | 1 | 0 | 1.79 | 12.0 |
| docslice | 15 | 13 | 0 | 2 | 1 | 1.73 | 6.5 |

## Results by model × arm

Only one model ran in this pass, so this table mirrors the by-arm table.

| Model / arm | Cells | Correct | Partial | Wrong | Unknowns | Mean score | Mean tool calls |
|---|---|---|---|---|---|---|---|
| claude-haiku / cold | 15 | 0 | 0 | 15 | 15 | 0.00 | 0.0 |
| claude-haiku / raw-fetch | 14 | 12 | 1 | 1 | 0 | 1.79 | 12.0 |
| claude-haiku / docslice | 15 | 13 | 0 | 2 | 1 | 1.73 | 6.5 |

## Notable cells

**Cold answers that were correct (possible training-data leakage):** none. Every cold cell was an admitted unknown, which is the desired behavior for this control — it suggests the questions genuinely require the target docs and the prompt-only suppression held.

**Suspicious cold cells with tool calls:** none. All 15 cold cells made zero tool calls.

**Retrieval answers that were still wrong:**

- `clean-exec-command` failed in both retrieval arms, and is the only question neither arm got right. The key is `myst clean --exec`. Raw-fetch answered `myst clean --all` / `myst clean --templates --cache` after 47 tool calls — its most expensive cell by far, and still wrong. Docslice answered `myst clean --execute` after only 3 calls — the right concept with a hallucinated long-form flag. This looks like a case where the exact flag string is hard to surface from the docs and the model fills the gap from priors.
- `docker-image-tag` (docslice): the model found `quay.io` but burned 27 tool calls without locating the `cryo-hub-image` name and admitted it could not determine it. Raw-fetch got the same question fully correct in 6 calls, so the content is retrievable — this is docslice's one clear retrieval miss.
- `gcov-supporting-layers` (raw-fetch, partial): got `numberOfLooks` and `rtcGammaToSigmaFactor` but substituted `projection` for `mask`. Docslice got all three in 3 calls.

**Tool-call spread:** docslice's per-cell counts are mostly very low (2–5 calls for 10 of 15 cells) but with heavy tails on its two failures (17, 27). Raw-fetch is more uniformly expensive (typically 6–15) with one extreme outlier (47). Docslice's efficiency advantage comes from its cheap successes, not from capping its failures.

## Caveats

- **Cold-arm suppression is prompt-only.** The model was instructed not to use tools rather than having them removed, so cold results measure instruction-following plus parametric knowledge, not a hard no-retrieval condition. In this run the instruction held (zero tool calls), but that is not guaranteed across models or reruns.
- **Cost is measured in tool calls, not tokens.** The arms are Claude-native and token accounting was not captured. A docslice call and a raw fetch can return very different payload sizes, so the 6.5-vs-12 comparison understates or overstates the true cost gap depending on per-call payload; treat it as a proxy.
- **Grading is single-pass.** Each cell was graded once by an LLM judge with no second opinion or human adjudication, so individual verdicts (especially partial-vs-wrong boundaries and the admitted-unknown rule) carry some noise. With only 14–15 cells per arm, one or two flipped verdicts would move the arm means materially — the raw-fetch/docslice gap (1.79 vs 1.73) is well within that noise.
- **One model, one run.** All results are claude-haiku on a single pass; no variance estimate, and the missing raw-fetch cell means arm totals are not over identical question sets.
