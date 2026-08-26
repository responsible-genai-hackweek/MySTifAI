import { describe, it, expect } from 'vitest';
import { renderMd } from '../src/render.js';
import { subsetByAnchor, flattenBlocks } from '../src/mdast.js';
import { loadFixture, fixtureSites, fixturePages } from './helpers.js';

describe('renderMd', () => {
  it('renders a simple subtree to markdown', () => {
    const root = {
      type: 'root',
      children: [
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Hello' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'World.' }] },
      ],
    };
    const { markdown, warnings } = renderMd(root as any);
    expect(markdown).toContain('## Hello');
    expect(markdown).toContain('World.');
    expect(warnings).toEqual([]);
  });
});

describe('round-trip: every fixture section renders to non-empty markdown', () => {
  const gaps = new Map<string, number>();
  for (const site of fixtureSites()) {
    for (const f of fixturePages(site)) {
      it(`${site}/${f}`, () => {
        const page = loadFixture(site, f);
        const headings = flattenBlocks(page.mdast).filter(
          (n: any) => n.type === 'heading' && (n.html_id || n.identifier),
        );
        for (const hd of headings) {
          const sub = subsetByAnchor(page.mdast, (hd as any).html_id ?? (hd as any).identifier);
          const { markdown, warnings } = renderMd(sub);
          expect(markdown.trim().length).toBeGreaterThan(0);
          for (const w of warnings) gaps.set(w, (gaps.get(w) ?? 0) + 1);
        }
      });
    }
  }
  it('report gaps', () => {
    // Not an assertion — prints the myst-to-md unsupported-node tally for docs/renderer-gaps.md
    console.error('renderer gaps:', Object.fromEntries(gaps));
  });
});

const GOLDEN: [site: string, page: string, anchor: string][] = [
  // grid/cards
  ['jupyterbook', 'page.accessibility.json', 'get-involved'],
  // admonition
  ['mystmd-guide', 'page.website-style.json', 'light-dark-css'],
  // figure
  ['mystmd-guide', 'page..json', 'cool-myst-features'],
  // notebook code cell/output (exercises the container-throw guard)
  ['mystmd-guide', 'page.interactive-notebooks.json', 'static-images'],
  // math
  ['mystmd-guide', 'page..json', 'project-goals'],
  // cross-reference-heavy
  ['mystmd-guide', 'page.website-style.json', 'style-sheet'],
];
describe('golden sections', () => {
  for (const [site, pageFile, anchor] of GOLDEN) {
    it(`${site} #${anchor}`, () => {
      const page = loadFixture(site, pageFile);
      const { markdown } = renderMd(subsetByAnchor(page.mdast, anchor));
      expect(markdown).toMatchSnapshot();
    });
  }
});
