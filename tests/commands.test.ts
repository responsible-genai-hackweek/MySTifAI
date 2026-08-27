process.env.DOCSLICE_CACHE = 'off';

import { describe, it, expect, afterAll } from 'vitest';
import { getSection, outlineSite, outlinePage, searchSite } from '../src/commands.js';
import { AnchorNotFoundError } from '../src/mdast.js';
import { serveFixtures } from './serve-fixtures.js';

const guide = await serveFixtures('mystmd-guide');
afterAll(() => guide.close());

describe('getSection', () => {
  it('returns the section subtree for a page anchor', async () => {
    const root = await getSection(`${guide.base}/interactive-notebooks#static-images`);
    expect(root.children[0]).toMatchObject({ type: 'heading' });
  });
  it('falls back to a site-wide label lookup from the site root', async () => {
    // img:mpl / #img-mpl lives on /interactive-notebooks, not the root page;
    // this only works via the site-wide lookup fallback.
    const root = await getSection(`${guide.base}#img-mpl`);
    expect(JSON.stringify(root)).toContain('img:mpl');
  });
  it('throws AnchorNotFoundError when no page on the site has the label', async () => {
    await expect(getSection(`${guide.base}#no-such-label`)).rejects.toBeInstanceOf(
      AnchorNotFoundError,
    );
  });
});

describe('outlineSite', () => {
  it('lists every page with absolute URL and title', async () => {
    const rows = await outlineSite(guide.base);
    expect(rows).toContainEqual({
      url: `${guide.base}/interactive-notebooks`,
      title: 'Generate and Display Rich Outputs',
    });
  });
});

describe('outlinePage', () => {
  it('lists anchored headings, whether the page is given as path or full URL', async () => {
    const byPath = await outlinePage(guide.base, '/interactive-notebooks');
    expect(byPath.map((h) => h.anchor)).toContain('static-images');
    expect(await outlinePage(guide.base, `${guide.base}/interactive-notebooks`)).toEqual(byPath);
  });
});

describe('searchSite', () => {
  it('returns absolute url#anchor hits', async () => {
    const { hits, fetchedNone } = await searchSite(guide.base, 'altair');
    expect(fetchedNone).toBe(false);
    expect(hits.some((h) => h.url === `${guide.base}/interactive-notebooks#interactive-visualizations`)).toBe(true);
  });
});
