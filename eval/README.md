# docslice retrieval eval

Does docslice's section-level retrieval accomplish what it claims - less context, fewer dead ends, answers a naive fetch can't reach - on real MyST docs sites?
What it measures and why, with results, is documented on the docs site in [`docs/evaluation.md`](../docs/evaluation.md); this file is just how to run it.

It has two layers.
Layer 1 is deterministic and free; Layer 2 calls real models and costs real money.
Neither is part of `npm test` (which stays offline) or CI - both are invoked manually, below.

## Layer 1: context cost (deterministic, run any time)

```bash
npm run eval:context
```

For every question, measures how many characters each strategy puts in context to contain the answer - full HTML page, full page as docslice markdown, just the answer's section via docslice - and verifies the answer is actually in the section (each question's `grep` field).
It uses no models, takes about a minute against the live sites, and exits 1 if any section lost its answer.
It runs the working-tree CLI (`npx tsx src/cli.ts`), so it measures your changes.

## Layer 2: behavioral eval (models, run sparingly)

Askers get **only the site root** - finding the right page is part of what's measured.
One asker agent per (question x model x arm) cell, one evaluator per answer (pinned to the `sonnet` tier so grading stays comparable across runs).

One-time setup: `npm install -g docslice` (the docslice arm shells out to the installed CLI).

Two steps: build the args JSON, then invoke the Workflow tool with it from a Claude Code session in this repo.

```bash
# full matrix (prints cell/agent-call counts to stderr):
npm run eval:args > /tmp/eval-args.json

# or trim it - any of --sites, --models, --arms, comma-separated ids:
npm run eval:args -- --sites cryocloud --models claude-haiku > /tmp/eval-args.json
```

Then, in a Claude Code session:

> Run the Workflow tool with scriptPath `eval/run.workflow.js` and the args in `/tmp/eval-args.json`.

The workflow can't read files itself, which is why the args come from the invoking session; the run happens inside Claude Code because the asker and evaluator cells *are* Claude Code subagents (that's also what makes the model legs free of API-key plumbing).

## Saving results

Runs worth keeping - a new site, a new model, before/after a docslice change - get committed under `eval/results/<YYMMDD>-<short-slug>/`:

- `report.md` - the workflow's synthesized report, prepended with a header recording the date, the cell matrix, and which actual models the `haiku`/`sonnet`/`opus` tiers resolved to that day
- `raw.json` - per-cell answers and verdicts, aggregates, and per-agent token counts.
  The workflow script can't see token usage, but the run's metadata records it per agent; ask the invoking session to harvest those numbers into `raw.json`, because the per-arm token comparison is the cost metric that matters.
- `context-cost.tsv` - a `npm run eval:context` snapshot from the same day

Scratch runs (debugging a prompt, trying one cell) don't get committed.

## Adding a target site

Drop a new `questions/<site>.yaml` next to the existing ones - schema is documented in the header of [`questions/cryocloud.yaml`](questions/cryocloud.yaml) - and both layers pick it up automatically.
Phrase questions the way a scientist learning that community's workflows would ask them ("which bucket should I use for...", "how do I run..."), but anchor every answer key to a site-specific detail (a bucket name, an exact flag, a tool choice) so the cold arm can't succeed from general knowledge.
Verify every answer against the live site with docslice before committing (`npm run eval:context` checks the `section`/`grep` fields for you).
A bank can also include `not_stated` trick questions - realistic asks the site does *not* answer - where the correct behavior is a grounded "the docs don't say" and the failure mode is a confabulated answer.

## Known limitations

Stated here so the reports don't imply precision they don't have:

- **Cold-arm tool suppression is a prompt instruction, not a sandbox.** Nothing strips an agent's tools; it's told not to use them. Check `commands_run` if a cold answer looks suspicious.
- **Grading is single-pass.** One evaluator call per answer, not an adversarial panel. Enough to check whether docslice helps; add a 2-of-3 verify pass if you need higher confidence.
- **One attempt per cell.** Arm-level aggregates over all 15 questions are meaningful; single-cell differences are noise.
