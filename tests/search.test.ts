import { describe, it, expect, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { searchPages } from '../src/search.js';
import { loadFixture } from './helpers.js';
import { serveFixtures } from './serve-fixtures.js';

const run = promisify(execFile);
const guide = await serveFixtures('mystmd-guide');
afterAll(() => guide.close());

// Run via tsx so no build step is needed; cache off so tests stay hermetic.
function cli(...args: string[]) {
  return run('npx', ['tsx', 'src/cli.ts', ...args], {
    env: { ...process.env, MYST_DOCS_CACHE: 'off' },
  });
}

// Cold `npx tsx` subprocess spawns can brush vitest's 5s default on a cold
// CI runner.
const TIMEOUT = 15_000;

describe('searchPages', () => {
  it('finds a phrase within a section and returns its anchor and snippet', () => {
    const page = loadFixture('mystmd-guide', 'page.interactive-notebooks.json');
    const hits = searchPages([{ url: '/interactive-notebooks', mdast: page.mdast }], 'altair');
    const hit = hits.find((h) => h.anchor === 'interactive-visualizations');
    expect(hit).toBeDefined();
    expect(hit!.url).toBe('/interactive-notebooks');
    expect(hit!.snippet.toLowerCase()).toContain('altair');
  });
});

describe('myst-docs search', () => {
  it('prints tab-separated url#anchor and snippet for a matching query', async () => {
    const { stdout } = await cli('search', guide.base, 'altair');
    expect(stdout).toMatch(/\t/);
    expect(stdout).toContain('#interactive-visualizations');
  }, TIMEOUT);
  it('exits 1 when nothing matches', async () => {
    await expect(cli('search', guide.base, 'zzzgibberishzzz')).rejects.toMatchObject({ code: 1 });
  }, TIMEOUT);
});
