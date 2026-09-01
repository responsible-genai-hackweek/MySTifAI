#!/usr/bin/env node
// Build the `args` JSON that eval/run.workflow.js expects, from
// eval/questions/*.yaml and eval/models.yaml, and print it to stdout.
// The Workflow script has no filesystem access by design; this is the bridge.
//
// Usage:
//   node eval/load-args.mjs [--sites a,b] [--models x,y] [--arms cold,docslice]
//
// Filters trim the question x model x arm matrix; ids not found fail loudly.
// stdout is the payload (JSON), stderr is diagnostics.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const EVAL = dirname(fileURLToPath(import.meta.url));

function csvFlag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? '').split(',').filter(Boolean);
}

function filterByIds(items, wanted, what) {
  if (!wanted) return items;
  const have = new Set(items.map((x) => x.id));
  const missing = wanted.filter((id) => !have.has(id));
  if (missing.length) {
    console.error(`error: unknown ${what}: ${missing.join(', ')} (have: ${[...have].join(', ')})`);
    process.exit(1);
  }
  return items.filter((x) => wanted.includes(x.id));
}

const questionSets = readdirSync(join(EVAL, 'questions'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({
    id: basename(f, '.yaml'),
    ...yaml.load(readFileSync(join(EVAL, 'questions', f), 'utf8')),
  }));

const config = yaml.load(readFileSync(join(EVAL, 'models.yaml'), 'utf8'));

const args = {
  questionSets: filterByIds(questionSets, csvFlag('sites'), 'site'),
  models: filterByIds(config.models, csvFlag('models'), 'model'),
  arms: filterByIds(config.arms, csvFlag('arms'), 'arm'),
};

const cells = args.questionSets.reduce((n, s) => n + s.questions.length, 0) * args.models.length * args.arms.length;
console.error(`${cells} cells (${args.questionSets.length} sites x ${args.models.length} models x ${args.arms.length} arms), ~${2 * cells + 1} agent calls`);
console.log(JSON.stringify(args, null, 2));
