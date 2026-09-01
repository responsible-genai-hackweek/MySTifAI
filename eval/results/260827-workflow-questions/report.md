<!-- Run record for the docslice retrieval eval; see eval/README.md. -->
**Date:** 2026-08-27
**Matrix:** 3 sites x 15 scientist-workflow questions (incl. 1 `not_stated` trick) x claude-haiku x [cold, raw-fetch, docslice] = 45 cells (43 graded; two raw-fetch askers returned no structured output)
**Arms:** both retrieval arms start from the site root only
**Question banks:** first run of the reworked scientist-workflow banks - not comparable to the 260826 run
**Tier -> model that day:** haiku = claude-haiku-4-5-20251001; evaluator (sonnet) = claude-sonnet-5
**Cost:** 89 agent calls, ~2.93M subagent tokens, 6m7s wall clock
**Workflow run id:** wf_81a0a1d1-f15

## Token cost per question (harvested from run metadata)

Whole-asker-agent tokens; the cold arm is the no-retrieval baseline, so the last
column is what retrieval itself cost.

| Arm | Mean score | Mean asker tokens | Retrieval tokens (minus cold baseline) |
|---|---|---|---|
| cold | 0.07 | 21,937 | 0 |
| raw-fetch | 1.46 | 52,628 | 30,691 |
| docslice | 1.87 | 27,811 | 5,874 |

On workflow-style questions docslice beat raw-fetch on BOTH accuracy (1.87 vs
1.46) and cost (5.2x fewer retrieval tokens, ~3x fewer tool calls). The
`not_stated` trick question (atl06-bucket) separated the arms qualitatively:
raw-fetch hallucinated a concrete bucket name the site never states; docslice
searched, found nothing, and correctly answered "the book doesn't name one."

---

# Docslice retrieval eval report

Single-model run (claude-haiku) over 15 questions about a MyST/Jupyter Book documentation corpus, three arms: `cold` (no retrieval, prompt-suppressed), `raw-fetch` (fetch pages directly), `docslice` (structured outline/slice retrieval). Scoring: 2 = correct, 1 = partial, 0 = wrong.

## Headline

Yes, the expected ordering holds: **docslice (mean 1.87) > raw-fetch (mean 1.46) > cold (mean 0.07)**. Docslice got 14/15 correct with a mean of 4.2 tool calls per question; raw-fetch got 9/13 correct at 11.8 tool calls per question — so docslice was both more accurate and roughly 3x cheaper in tool calls. Cold answered essentially nothing correctly (0 correct, 1 partial), which confirms the questions are not answerable from training data alone.

Note the raw-fetch arm ran only 13 of the 15 cells (`execute-at-build` and `clean-exec-command` are missing), so its aggregates are not over an identical question set.

## Results by arm

| Arm | Cells | Correct | Partial | Wrong | Unknowns | Mean score | Mean tool calls |
|---|---|---|---|---|---|---|---|
| cold | 15 | 0 | 1 | 14 | 14 | 0.07 | 0.0 |
| raw-fetch | 13 | 9 | 1 | 3 | 1 | 1.46 | 11.8 |
| docslice | 15 | 14 | 0 | 1 | 1 | 1.87 | 4.2 |

## Results by model x arm

Only one model ran, so this table mirrors the by-arm table.

| Model / arm | Cells | Correct | Partial | Wrong | Mean score | Mean tool calls |
|---|---|---|---|---|---|---|
| claude-haiku / cold | 15 | 0 | 1 | 14 | 0.07 | 0.0 |
| claude-haiku / raw-fetch | 13 | 9 | 1 | 3 | 1.46 | 11.8 |
| claude-haiku / docslice | 15 | 14 | 0 | 1 | 1.87 | 4.2 |

## Notable cells

**Cold answers that were correct (training-data leakage):** none. All 15 cold cells scored wrong except one partial (`atl06-bucket`, where the model correctly declined to invent a bucket name). No cold cell produced a correct answer, so there is no evidence of the answer key leaking from training data in this run.

**Suspicious cold cells with tool calls:** none. Every cold cell made 0 tool calls, so the prompt-only suppression held.

**Retrieval answers that were still wrong:**

- `raw-fetch / scratch-bucket` (9 calls) — named the wrong location (a shared-public folder instead of `s3://nasa-cryo-scratch`) and missed the 7-day auto-deletion.
- `raw-fetch / atl06-bucket` (9 calls) — hallucinated a concrete bucket name (`nsidc-cumulus-prod-protected`) that the book never states. Docslice handled the same question correctly by saying the book doesn't specify one, though it took 14 tool calls to conclude that — its most expensive cell.
- `raw-fetch / matplotlib-strings-default` (27 calls) — spent the most tool calls of any cell and still gave up without locating the setting.
- `raw-fetch / gcov-hdf5-path` (partial) — correct HDF5 path but listed VVVV instead of HVHV.
- `docslice / clean-exec-command` (3 calls) — docslice's only miss: answered `myst clean --execute` instead of `myst clean --exec`. A near-miss flag error rather than a retrieval failure.

The raw-fetch failure pattern is worth noting: its wrong answers were confident fabrications or expensive dead ends, while docslice's single miss was a one-token flag error. Raw-fetch also showed high variance in cost (3 to 28 calls per question) versus docslice's tight range (2 to 14, mostly 2-5).

## Caveats

- **Cold-arm suppression is prompt-only.** The cold arm was told not to use tools rather than having tools removed, so "0 tool calls" reflects instruction-following, not a hard guarantee. It held in this run.
- **Cost is measured in tool calls, not tokens.** A docslice call and a raw page fetch can return very different payload sizes, so the 3x tool-call advantage may understate or overstate the true token/latency difference.
- **Grading is single-pass.** Each cell was judged once by an LLM grader with no second opinion; individual verdicts (especially partials and near-misses) carry some noise.
- **Unequal cell counts.** Raw-fetch is missing 2 of the 15 questions, so arm means are not computed over identical question sets.
- **One model, one run.** No variance estimate; differences between arms are large but unreplicated.
