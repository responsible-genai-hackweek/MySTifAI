---
short_title: Evaluating
---

# Does it Help?

We measured whether docslice helps agents answer questions from a docs site, compared to generic web fetching.
This page reports the method and the numbers, including the parts that don't flatter the tool.

## Method

Six agents each answered the same five questions about the Jupyter Book project from [jupyterbook.org](https://jupyterbook.org).
The questions were chosen so the answers could not come from model memory: they concern a job posting, roadmap board, and application process published after the models' training cutoffs, and every answer was verified against the live site first.
Three model tiers (small, medium, frontier) ran in two conditions: **with docslice** (the published `npx docslice` package plus its ~30-line skill text, nothing else) and **baseline** (generic web fetching, including an AI-summarizing fetcher where available).

## Results

Every agent in every condition eventually answered all five questions correctly.
The difference is what it cost them:

| Model tier | With docslice | Baseline (web fetching) |
| --- | --- | --- |
| Small (Haiku) | 6 commands, 0 dead ends | 23 fetches, ~10 of them 404s from guessed URLs |
| Medium (Sonnet) | 4 commands, 1 retry | 11 fetches, 3 dead ends, twice fell back to `curl` + grepping raw HTML |
| Frontier | 4 commands, 0 dead ends | 6 fetches, 1 verification re-fetch |

## Reading the numbers honestly

The effort gap grows as model capability drops: 1.5x for the frontier tier, 2.8x for the medium tier, 3.8x for the small tier.
With docslice, all three tiers converge on the same 4-6 command pattern: outline the site, `get` the two relevant pages, done.
The titled outline mattered most; no agent even needed `search` to locate the right pages.

The small-model baseline is the case the tool exists for.
Without link structure it could trust, it guessed URL patterns (`/community/jobs.html`, `/community/governance.html`, ...) and burned ten fetches on 404s.
The medium-model baseline got correct answers but stopped trusting its summarizing fetcher and resorted to grepping text nodes out of raw HTML, which is exactly the work this tool packages.

What the numbers do not show: correctness differences.
On a well-linked 24-page site with an AI-summarizing fetcher available, capable models get there without docslice, just more slowly.
The tool's advantage should grow on larger sites, for agents whose only fetcher is raw HTTP, and under token budgets, but we have not measured those conditions.

## Limits of this evaluation

One site, five questions, one run per cell, and the baseline had an AI-summarizing fetcher that many agent stacks lack.
An earlier adversarial review of the tool and its remaining gaps is recorded in the project's decision log.
