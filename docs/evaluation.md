---
short_title: Evaluating
kernelspec:
  name: bash
  display_name: Bash
---

# Evaluating this tool

We measured whether docslice helps agents answer questions from real MyST docs sites, compared to generic web fetching.
Results come first, including the parts that don't flatter the tool; methodology and reproduction steps follow.

## Results

From the committed baseline run of the behavioral eval (claude-haiku, 15 questions across three sites, 2026-08-27; full record in [`eval/results/`](https://github.com/responsible-genai-hackweek/MySTifAI/tree/main/eval/results)):

| Arm | Mean score (0-2) | Retrieval tokens per question | Mean tool calls |
| --- | --- | --- | --- |
| cold | 0.07 | 0 | 0 |
| raw-fetch | 1.46 | 30,691 | 11.8 |
| docslice | 1.87 | 5,874 | 4.2 |

docslice beat whole-page fetching on both accuracy and cost: better answers at 5x fewer retrieval tokens and 3x fewer tool calls.
Cold answered essentially nothing, which confirms the questions aren't in training data.

The failure modes differed more than the scores.
raw-fetch's wrong answers were confident fabrications: on a trick question with no answer on the site, it invented a plausible S3 bucket name, while docslice searched the site, found nothing, and correctly answered "the book doesn't name one."
docslice's single miss was a one-token flag error (`--execute` for `--exec`) after correct retrieval.

The token gap matches a model-free measurement of the sites themselves: across the question banks, the section holding an answer is 3.5x smaller than its page as markdown and about 70x smaller than the page as HTML (measured live in [Methodology](#methodology) below).
An [earlier one-off study](#earlier-study) saw the same advantage as effort rather than correctness: a fetch-count gap that grows as models get smaller, from 1.5x for a frontier model to 3.8x for a small one.

Read all of these numbers with their limits in mind: one model per run, one run per cell, single-pass grading, and cold-arm tool suppression is a prompt instruction rather than a sandbox.
The full limitations list is in [`eval/README.md`](https://github.com/responsible-genai-hackweek/MySTifAI/blob/main/eval/README.md).

(methodology)=
## Methodology

docslice makes three claims, and the eval measures them separately:

1. **Context economy** - reading one section instead of a whole page keeps context small.
2. **Reliable navigation** - `outline`/`search` find the right place without URL-guessing and HTML-grepping dead ends.
3. **An accuracy floor** - for smaller models and bigger sites, 1 and 2 compound into answers a naive approach gets wrong.

%CH: Link the three books below
The raw material lives in [`eval/`](https://github.com/responsible-genai-hackweek/MySTifAI/tree/main/eval): question banks against three real MyST sites (the CryoCloud book, the NISAR Cookbook, and the MyST guide), phrased the way a scientist learning that community's workflows would ask them.
Every answer key is anchored to a verified site-specific detail and the exact section where it lives, so a model can't answer from general knowledge.
Banks also include `not_stated` trick questions the site doesn't answer ("which S3 bucket holds ATL06?" - none is named), where correct means a grounded "the docs don't say" and the failure mode is confabulating a plausible answer.

### Context cost, measured directly

Claim 1 doesn't need a model to test.
How much text must enter context to contain the answer is a property of the site and the tool, so a plain script measures it exactly: the full page as HTML, the full page as docslice markdown, and just the answer's section.
The script also checks mechanically that each section really contains its answer.
This cell runs the measurement live, at doc build time; expand the output for the per-question numbers:

```{code-cell} bash
:tags: [hide-output]
node ../eval/context-cost.mjs 2>&1 | column -t -s$'\t'
```

Because no model is involved, the numbers are exact and cheap to reproduce.
The script also shows where docslice *can't* help: a page with no heading anchors (like the CryoCloud best-practices page) has a whole-page smallest section, ratio 1.0, which is honest data about the tool's dependence on site structure.

### The behavioral eval

Claims 2 and 3 need an agent actually trying.
Every question runs under three retrieval conditions, on the same model, starting from **only the site root** - finding the right page is part of what's measured:

cold
: No retrieval; answer from parametric knowledge or admit not knowing.
: The floor, and a tripwire: a correct cold answer means the fact leaked into training data, so the question no longer measures retrieval.

raw-fetch
: Fetch whole pages and read them end to end.
: The "stuff pages into context" baseline docslice has to beat.

docslice
: `docslice outline` / `search` to survey, then `docslice get 'url#anchor'` for just the relevant section.
: The arm under test.

A controller workflow fans every (question x model x arm) cell out to an asker agent, grades each answer against the key with an evaluator agent, and reports accuracy, dead ends, and per-arm token cost.

(earlier-study)=
### The earlier one-off study

Before the repeatable eval, six agents each answered the same five questions about [jupyterbook.org](https://jupyterbook.org), chosen so the answers could not come from model memory (published after the models' training cutoffs).
Every agent eventually answered all five correctly; the difference was what it cost them:

| Model tier | With docslice | Baseline (web fetching) |
| --- | --- | --- |
| Small (Haiku) | 6 commands, 0 dead ends | 23 fetches, ~10 of them 404s from guessed URLs |
| Medium (Sonnet) | 4 commands, 1 retry | 11 fetches, 3 dead ends, twice fell back to `curl` + grepping raw HTML |
| Frontier | 4 commands, 0 dead ends | 6 fetches, 1 verification re-fetch |

The small-model baseline is the case the tool exists for: without link structure it could trust, it guessed URL patterns and burned ten fetches on 404s.
This study's baseline had an AI-summarizing fetcher that many agent stacks lack, and agents were not confined to the site root; the behavioral eval removes both, which is where correctness differences appeared.
An earlier adversarial review of the tool and its remaining gaps is recorded in the project's decision log.

## Reproducing it

The context-cost measurement is free and runs in about a minute: `npm run eval:context`.
The behavioral eval calls real models and costs real money, so it is deliberately not part of `npm test` (which stays offline) or any CI job.
[`eval/README.md`](https://github.com/responsible-genai-hackweek/MySTifAI/blob/main/eval/README.md) is the how-to: exact commands for both layers, how to add a new site's question bank (drop in one yaml file; nothing else changes), and where results get committed.
Committed results under `eval/results/` are what make runs comparable over time: did a docslice change improve accuracy, did a newer model absorb one of the facts and stop needing retrieval at all?
