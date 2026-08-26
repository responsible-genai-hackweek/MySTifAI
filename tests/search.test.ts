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

// A single-heading page's mdast, in the same block-wrapped shape a deployed
// site serves; used to build a pile of synthetic pages for the cap test.
function widgetPage(id: number) {
  return {
    type: 'root',
    children: [
      {
        type: 'block',
        children: [
          { type: 'heading', depth: 1, html_id: `widget-${id}`, children: [{ type: 'text', value: 'Widget' }] },
          { type: 'paragraph', children: [{ type: 'text', value: `Widget content number ${id}` }] },
        ],
      },
    ],
  };
}

describe('searchPages', () => {
  it('finds a phrase within a section and returns its anchor and snippet', async () => {
    const page = loadFixture('mystmd-guide', 'page.interactive-notebooks.json');
    const hits = await searchPages([{ url: '/interactive-notebooks', mdast: page.mdast }], 'altair');
    const hit = hits.find((h) => h.anchor === 'interactive-visualizations');
    expect(hit).toBeDefined();
    expect(hit!.url).toBe('/interactive-notebooks');
    expect(hit!.snippet.toLowerCase()).toContain('altair');
  });

  it('ranks a heading hit above a body-text hit for the same term', async () => {
    // "notebooks" is in the heading "Include notebooks in your MyST site"
    // (#include-notebooks-in-your-myst-site), and also just body text in the
    // page's lead-in paragraph (before the first heading, so no anchor).
    const page = loadFixture('mystmd-guide', 'page.interactive-notebooks.json');
    const hits = await searchPages([{ url: '/interactive-notebooks', mdast: page.mdast }], 'notebooks');
    const headingIndex = hits.findIndex((h) => h.anchor === 'include-notebooks-in-your-myst-site');
    const bodyIndex = hits.findIndex((h) => h.anchor === undefined);
    expect(headingIndex).toBeGreaterThanOrEqual(0);
    expect(bodyIndex).toBeGreaterThan(headingIndex);
  });

  it('returns hits for a question-style, multi-word query', async () => {
    // The query's words all appear in this section, but not as that exact
    // phrase (the section says "this paper", not "a paper") — a plain
    // substring matcher would find nothing here.
    const page = {
      type: 'root',
      children: [
        {
          type: 'block',
          children: [
            { type: 'heading', depth: 1, html_id: 'citing', children: [{ type: 'text', value: 'Citing' }] },
            {
              type: 'paragraph',
              children: [
                { type: 'text', value: 'Readers often ask: how do I cite this paper correctly, with a DOI?' },
              ],
            },
          ],
        },
      ],
    };
    const hits = await searchPages([{ url: '/citing', mdast: page }], 'how do I cite a paper');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('strips stopwords so a question-style query matches the same as its bare terms', async () => {
    // The upstream engine ANDs every query token, so the unstripped phrase
    // ("how"/"do"/"i" included) wouldn't match a section that only contains
    // "Cite mystmd" / "cite ... mystmd". Stripping stopwords should make the
    // question equivalent to searching the bare content words.
    const page = loadFixture('mystmd-guide', 'page..json');
    const pages = [{ url: '/', mdast: page.mdast }];
    const question = await searchPages(pages, 'how do I cite mystmd');
    const bare = await searchPages(pages, 'cite mystmd');
    expect(question.length).toBeGreaterThan(0);
    expect(question).toEqual(bare);
  });

  it('caps: more than 20 matches can exist, for cli.ts to slice down to 20', async () => {
    const pages = Array.from({ length: 25 }, (_, i) => ({ url: `/widget-${i}`, mdast: widgetPage(i) }));
    const hits = await searchPages(pages, 'widget');
    expect(hits.length).toBeGreaterThan(20);
    expect(hits.slice(0, 20)).toHaveLength(20);
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
