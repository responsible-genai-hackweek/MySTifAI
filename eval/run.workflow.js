export const meta = {
  name: 'docslice-retrieval-eval',
  description: 'Ask obscure MyST-site facts under cold / raw-fetch / docslice arms, grade against answer keys',
  phases: [
    { title: 'Ask', detail: 'one asker agent per (question x model x arm) cell' },
    { title: 'Grade', detail: 'one evaluator agent per answer' },
    { title: 'Report', detail: 'synthesize markdown report from aggregates' },
  ],
}
// Controller for the docslice retrieval eval. Run via the Workflow tool with
// args produced by `node eval/load-args.mjs` ({questionSets, models, arms}).
// Design rationale: eval/README.md and docs/evaluation.md.

if (!args || !args.questionSets || !args.models || !args.arms) {
  throw new Error('args must be {questionSets, models, arms} - build them with: node eval/load-args.mjs')
}

// Operative behavior of each arm. Ids must match eval/models.yaml.
// Known limitation: cold-arm tool suppression is a prompt instruction, not a
// sandbox - check commands_run when a cold answer looks suspiciously good.
const ARM_INSTRUCTIONS = {
  'cold': `Answer from your own knowledge ONLY. Do not use any tools: no shell
commands, no fetching, no file reads. If you do not know the answer, say so
plainly and set admitted_unknown to true - a confident guess is worse than an
admitted unknown.`,
  // Both retrieval arms get only the site root - finding the right page is
  // part of what's being measured. Never leak the question's source URL.
  'raw-fetch': `You may fetch whole pages and read them end to end, e.g.
\`curl -sL <url>\`. Do not use docslice or any other section-level retrieval
tool - whole-page fetching only. The answer is somewhere on the site {SITE};
finding the right page is up to you.`,
  'docslice': `Use the docslice CLI for section-level retrieval (run
\`npm install -g docslice\` first if the command is missing):
  docslice outline <site-url>       # list pages, or one page's sections
  docslice search <site-url> "..."  # find url#anchor across the site
  docslice get '<url>#<anchor>'     # print just that section as markdown
Prefer reading single sections over whole pages. The site is {SITE}. Do not
fetch pages any other way (no curl / raw fetching).`,
}

const ASKER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'admitted_unknown', 'tool_calls_made', 'commands_run'],
  properties: {
    answer: { type: 'string', description: 'Your final answer to the question, concise' },
    admitted_unknown: { type: 'boolean', description: 'True if you could not determine the answer' },
    tool_calls_made: { type: 'integer', description: 'How many tool calls you made in total' },
    commands_run: { type: 'array', items: { type: 'string' }, description: 'Every shell command you ran, verbatim; empty if none' },
  },
}

const EVAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'score', 'rationale'],
  properties: {
    verdict: { type: 'string', enum: ['correct', 'partial', 'wrong'] },
    score: { type: 'integer', enum: [0, 1, 2] },
    rationale: { type: 'string', description: 'One or two sentences: what matched or was missing' },
  },
}

function askerPrompt(cell) {
  const armText = ARM_INSTRUCTIONS[cell.arm.id].replaceAll('{SITE}', cell.site)
  return `You are one cell of a retrieval evaluation. Answer this question about
a documentation site.

Question: ${cell.question.question}

Retrieval rules for this cell (arm: ${cell.arm.id}):
${armText}

Report honestly: your final answer, whether you had to admit you don't know,
how many tool calls you made, and every shell command you ran.`
}

function evaluatorPrompt(cell, asked) {
  const rubric = cell.question.match === 'not_stated'
    ? `This is a TRICK question: the site does not answer it. The key describes
the true situation. Grading flips accordingly:
verdict correct (score 2): says the site does not state/name this (grounded -
ideally noting how the docs actually handle it, per the key).
verdict partial (score 1): says it could not find the answer, without asserting
a concrete one.
verdict wrong (score 0): asserts any concrete answer as if the site stated it.`
    : `verdict correct (score 2): satisfies the match type fully.
verdict partial (score 1): part of a must_include key, or right idea with the
exact fact wrong. An admitted unknown is NEVER partial.
verdict wrong (score 0): incorrect, or admitted unknown.`
  return `Grade one answer from a retrieval evaluation, strictly, against the key.

Question: ${cell.question.question}
Answer key: ${cell.question.answer}
Match type: ${cell.question.match} (exact_fact: the specific fact must be exact,
paraphrase around it is fine; must_include: every part of the key must be
present; not_stated: the site does not answer this question at all)
Grading notes: ${cell.question.notes}

The model answered: ${JSON.stringify(asked.answer)}
It admitted not knowing: ${asked.admitted_unknown}

${rubric}
Do not give credit for confidence or for plausible-but-unverifiable detail.`
}

// One cell per (question x model x arm), flat; pipeline() so no cell waits on
// another - a fast cold cell finishes while a docslice cell is still fetching.
const cells = []
for (const set of args.questionSets) {
  for (const question of set.questions) {
    for (const model of args.models) {
      for (const arm of args.arms) {
        cells.push({ set: set.id, site: set.site, question, model, arm })
      }
    }
  }
}
log(`${cells.length} cells across ${args.questionSets.length} site(s)`)

const results = await pipeline(
  cells,
  (cell) => {
    const opts = {
      label: `ask:${cell.question.id}/${cell.model.id}/${cell.arm.id}`,
      phase: 'Ask',
      schema: ASKER_SCHEMA,
      effort: 'low',
    }
    if (cell.model.provider === 'claude-native') opts.model = cell.model.model
    return agent(askerPrompt(cell), opts)
  },
  (asked, cell) => {
    if (!asked) return null
    // Evaluator model is pinned to sonnet so grading stays comparable across
    // runs regardless of which model drives the session.
    return agent(evaluatorPrompt(cell, asked), {
      label: `grade:${cell.question.id}/${cell.model.id}/${cell.arm.id}`,
      phase: 'Grade',
      schema: EVAL_SCHEMA,
      model: 'sonnet',
      effort: 'low',
    }).then((graded) => ({
      set: cell.set,
      question: cell.question.id,
      model: cell.model.id,
      arm: cell.arm.id,
      asked,
      graded,
    }))
  },
)

const done = results.filter(Boolean).filter((r) => r.graded)
log(`${done.length}/${cells.length} cells completed`)

function aggregate(keyOf) {
  const groups = {}
  for (const r of done) {
    const k = keyOf(r)
    groups[k] ??= { cells: 0, score: 0, correct: 0, partial: 0, wrong: 0, tool_calls: 0, unknowns: 0 }
    const g = groups[k]
    g.cells += 1
    g.score += r.graded.score
    g[r.graded.verdict] += 1
    g.tool_calls += r.asked.tool_calls_made
    if (r.asked.admitted_unknown) g.unknowns += 1
  }
  for (const g of Object.values(groups)) {
    g.mean_score = Math.round((g.score / g.cells) * 100) / 100
    g.mean_tool_calls = Math.round((g.tool_calls / g.cells) * 10) / 10
  }
  return groups
}

const aggregates = {
  by_arm: aggregate((r) => r.arm),
  by_model_and_arm: aggregate((r) => `${r.model}/${r.arm}`),
  by_model: aggregate((r) => r.model),
}

phase('Report')
const report = await agent(`Write a markdown report of this docslice retrieval
eval run. Aggregates (score: 2=correct, 1=partial, 0=wrong):
${JSON.stringify(aggregates, null, 2)}

Per-cell results:
${JSON.stringify(done.map((r) => ({ q: r.question, model: r.model, arm: r.arm, verdict: r.graded.verdict, tool_calls: r.asked.tool_calls_made, unknown: r.asked.admitted_unknown, rationale: r.graded.rationale })), null, 2)}

Structure: (1) headline - does docslice beat raw-fetch beat cold, by mean
score?; (2) a by-arm table and a model x arm table; (3) notable cells - cold
answers that were correct (training-data leakage), retrieval answers that were
still wrong, suspicious cold cells whose tool_calls_made > 0; (4) caveats:
cold-arm suppression is prompt-only, Claude-native cost is tool-call counts not
tokens, grading is single-pass. Plain prose, no hype. Return ONLY the markdown.`,
  { label: 'report', phase: 'Report' })

return { aggregates, report, cells: done }
