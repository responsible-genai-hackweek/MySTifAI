import { describe, it, expect } from 'vitest';
import { loadFixture, fixtureSites, fixturePages } from './helpers.js';

describe('fixtures', () => {
  for (const site of fixtureSites()) {
    it(`${site}: xref has page records with data + url`, () => {
      const xref = loadFixture(site, 'myst.xref.json');
      const pages = xref.references.filter((r: any) => r.kind === 'page');
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) {
        expect(p).toHaveProperty('data');
        expect(p).toHaveProperty('url');
      }
    });
    it(`${site}: page fixtures have an mdast root`, () => {
      for (const f of fixturePages(site)) {
        const page = loadFixture(site, f);
        expect(page.mdast?.type).toBe('root');
      }
    });
  }
});
