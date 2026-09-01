// Subprocess tests pin eval/load-args.mjs: the args shape run.workflow.js
// expects, the question-bank schema, and the filter flags. Offline - it only
// reads the committed yaml files.
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

function loadArgs(...flags: string[]) {
  return run('node', ['eval/load-args.mjs', ...flags]).then(({ stdout }) => JSON.parse(stdout));
}

describe('eval/load-args.mjs', () => {
  it('prints the {questionSets, models, arms} shape run.workflow.js expects', async () => {
    const args = await loadArgs();
    expect(args.questionSets.length).toBeGreaterThanOrEqual(3);
    expect(args.models.map((m: any) => m.id)).toContain('claude-haiku');
    expect(args.arms.map((a: any) => a.id)).toEqual(['cold', 'raw-fetch', 'docslice']);
  });

  it('every question has the documented schema fields', async () => {
    const args = await loadArgs();
    for (const set of args.questionSets) {
      expect(set.site).toMatch(/^https:\/\//);
      for (const q of set.questions) {
        expect(q).toMatchObject({
          id: expect.any(String),
          source: expect.stringMatching(/^https:\/\//),
          question: expect.any(String),
          answer: expect.any(String),
          notes: expect.any(String),
        });
        expect(['exact_fact', 'must_include', 'not_stated']).toContain(q.match);
        // section+grep anchor context-cost.mjs's answer check; not_stated
        // questions have no section that contains a non-answer
        if (q.match !== 'not_stated') {
          expect(String(q.grep).length).toBeGreaterThan(2);
          expect(q.section.startsWith(q.source)).toBe(true);
        }
      }
    }
  });

  it('filter flags trim the matrix', async () => {
    const args = await loadArgs('--sites', 'cryocloud', '--arms', 'cold,docslice');
    expect(args.questionSets.map((s: any) => s.id)).toEqual(['cryocloud']);
    expect(args.arms.map((a: any) => a.id)).toEqual(['cold', 'docslice']);
  });

  it('fails loudly on unknown ids', async () => {
    await expect(run('node', ['eval/load-args.mjs', '--models', 'nope'])).rejects.toMatchObject({ code: 1 });
  });
});
