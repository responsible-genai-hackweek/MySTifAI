import { describe, it, expect } from 'vitest';
import { subsetByAnchor, flattenBlocks } from '../src/mdast.js';
import { loadFixture, fixtureSites, fixturePages } from './helpers.js';

const h = (depth: number, id: string) => ({
  type: 'heading', depth, identifier: id, html_id: id,
  children: [{ type: 'text', value: id }],
});
const p = (value: string) => ({ type: 'paragraph', children: [{ type: 'text', value }] });

const doc = {
  type: 'root',
  children: [
    p('preamble'),
    h(1, 'title'), p('intro'),
    h(2, 'setup'), p('setup body'),
    h(3, 'details'), p('detail body'),
    h(2, 'usage'), p('usage body'),
  ],
};

describe('flattenBlocks', () => {
  it('unwraps one level of block nodes so headings become siblings', () => {
    const wrapped = {
      type: 'root',
      children: [
        { type: 'block', children: [h(1, 'title'), p('intro')] },
        { type: 'block', children: [h(2, 'setup')] },
        p('trailing'),
      ],
    };
    const flat = flattenBlocks(wrapped as any);
    expect(flat.map((n) => n.type)).toEqual(['heading', 'paragraph', 'heading', 'paragraph']);
    expect(subsetByAnchor(wrapped as any, 'title').children.length).toBe(4);
  });
});

describe('subsetByAnchor', () => {
  it('returns subtree from heading to next same-or-shallower heading', () => {
    const out = subsetByAnchor(doc as any, 'setup');
    const texts = JSON.stringify(out);
    expect(texts).toContain('setup body');
    expect(texts).toContain('detail body'); // deeper subsection included
    expect(texts).not.toContain('usage body'); // sibling excluded
    expect(texts).not.toContain('preamble');
  });
  it('no anchor returns whole page', () => {
    expect(subsetByAnchor(doc as any, undefined).children.length).toBe(doc.children.length);
  });
  it('unknown anchor throws with the anchor named', () => {
    expect(() => subsetByAnchor(doc as any, 'nope')).toThrow(/nope/);
  });
  it('depth limits included subsection levels', () => {
    const out = JSON.stringify(subsetByAnchor(doc as any, 'setup', { depth: 0 }));
    expect(out).toContain('setup body');
    expect(out).not.toContain('detail body');
  });
  it('non-heading anchor returns just that labeled node', () => {
    const fig = { type: 'container', kind: 'figure', identifier: 'fig:x', html_id: 'fig-x',
      children: [{ type: 'image', url: 'x.png' }] };
    const withFig = { type: 'root', children: [h(1, 'title'), p('intro'), fig, p('after')] };
    for (const anchor of ['fig:x', 'fig-x']) {
      const out = subsetByAnchor(withFig as any, anchor);
      expect(out.children).toEqual([fig]);
    }
  });
});

describe('subsetByAnchor on a labeled figure fixture', () => {
  it('resolves a figure by identifier and html_id, returning the container only', () => {
    const page = loadFixture('mystmd-guide', 'page.interactive-notebooks.json');
    for (const anchor of ['img:mpl', 'img-mpl']) {
      const out = subsetByAnchor(page.mdast, anchor);
      expect(out.children.length).toBe(1);
      expect(out.children[0].type).toBe('container');
    }
  });
});

describe('subsetByAnchor on fixtures', () => {
  for (const site of fixtureSites()) {
    for (const f of fixturePages(site)) {
      it(`${site}/${f}: every heading anchor yields a non-empty subtree`, () => {
        const page = loadFixture(site, f);
        const headings = flattenBlocks(page.mdast).filter(
          (n: any) => n.type === 'heading' && (n.html_id || n.identifier),
        );
        expect(headings.length).toBeGreaterThan(0); // sanity: fixture pages have headings
        for (const hd of headings) {
          const out = subsetByAnchor(page.mdast, hd.html_id ?? hd.identifier);
          expect(out.children.length).toBeGreaterThan(0);
        }
      });
    }
  }
});
