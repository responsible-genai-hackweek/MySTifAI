#!/usr/bin/env node
// Layer 1 of the retrieval eval: deterministic context cost, no models.
// For every question in eval/questions/*.yaml, measure how much text each
// retrieval strategy must put into an agent's context to contain the answer:
//   html    - the full page as served (what a raw HTML fetch reads)
//   page    - the full page as docslice markdown (whole-page retrieval)
//   section - just the question's section via docslice (the docslice claim)
// and verify the answer is actually in the section (the `grep` field).
//
// Network script (live sites) - run on demand, never part of `npm test`:
//   npm run eval:context
// stdout is the payload (TSV), stderr is diagnostics. Exit 1 if any section
// is missing its answer. Uses the working-tree CLI (npx tsx src/cli.ts) so it
// measures your changes, not the published package.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import yaml from 'js-yaml';

const EVAL = dirname(fileURLToPath(import.meta.url));
const run = promisify(execFile);

const cache = new Map();
function once(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}
// shortcut: bare fetch instead of src/fetch.ts - this is an eval script
// measuring live sites, not docslice internals; docslice's cache covers the rest.
const htmlChars = (url) => once(`html:${url}`, () => fetch(url).then((r) => r.text()).then((t) => t.length));
const docslice = (url) =>
  once(`md:${url}`, () =>
    run('npx', ['tsx', join(EVAL, '..', 'src', 'cli.ts'), 'get', url], { maxBuffer: 64 * 1024 * 1024 }).then((r) => r.stdout),
  );

const sets = readdirSync(join(EVAL, 'questions'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => yaml.load(readFileSync(join(EVAL, 'questions', f), 'utf8')));

console.log(['question', 'html_chars', 'page_chars', 'section_chars', 'page/section', 'html/section', 'answer_in_section'].join('\t'));
let missing = 0;
const totals = { html: 0, page: 0, section: 0 };
for (const set of sets) {
  for (const q of set.questions) {
    if (q.match === 'not_stated') continue; // no section contains a non-answer
    const [html, page, section] = await Promise.all([htmlChars(q.source), docslice(q.source), docslice(q.section)]);
    const found = section.toLowerCase().includes(String(q.grep).toLowerCase());
    if (!found) { missing += 1; console.error(`missing answer in section: ${q.id} (grep: ${q.grep})`); }
    totals.html += html; totals.page += page.length; totals.section += section.length;
    console.log([q.id, html, page.length, section.length,
      (page.length / section.length).toFixed(1), (html / section.length).toFixed(1), found].join('\t'));
  }
}
console.error(`totals: section markdown is ${(totals.page / totals.section).toFixed(1)}x smaller than page markdown, ${(totals.html / totals.section).toFixed(1)}x smaller than raw HTML${missing ? `; ${missing} section(s) MISSING their answer` : ''}`);
process.exit(missing ? 1 : 0);
