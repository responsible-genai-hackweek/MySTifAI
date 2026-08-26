process.env.MYST_DOCS_CACHE = 'off';

import { describe, it, expect, afterAll } from 'vitest';
import { resolvePage, findSiteRoot, NotMystSiteError } from '../src/resolve.js';
import { serveFixtures } from './serve-fixtures.js';

const guide = await serveFixtures('mystmd-guide');
const jb = await serveFixtures('jupyterbook');
// mystmd.org mounts several independent MyST sites under subpaths like
// /guide; reuse the same fixture site to exercise that non-empty root case.
const mounted = await serveFixtures('mystmd-guide', '/guide');
afterAll(() => {
  guide.close();
  jb.close();
  mounted.close();
});

describe('findSiteRoot', () => {
  it('finds the root for a page URL', async () => {
    const { root } = await findSiteRoot(new URL(`${guide.base}/interactive-notebooks`));
    expect(root).toBe(guide.base);
  });
  it('throws NotMystSiteError when no xref exists', async () => {
    await expect(findSiteRoot(new URL('http://127.0.0.1:1/nope'))).rejects.toThrow(
      NotMystSiteError,
    );
  });
  it('finds the root for a site mounted under a subpath', async () => {
    const { root } = await findSiteRoot(new URL(`${mounted.base}/guide/interactive-notebooks`));
    expect(root).toBe(`${mounted.base}/guide`);
  });
});

describe('resolvePage', () => {
  it('resolves a page URL with fragment to mdast + anchor', async () => {
    const r = await resolvePage(`${guide.base}/interactive-notebooks#img-mpl`);
    expect(r.page.mdast.type).toBe('root');
    expect(r.anchor).toBe('img-mpl');
  });
  it('resolves the site index page', async () => {
    const r = await resolvePage(`${jb.base}/`);
    expect(r.page.mdast.type).toBe('root');
    expect(r.anchor).toBeUndefined();
  });
  it('resolves a nested page', async () => {
    const r = await resolvePage(`${jb.base}/community/team`);
    expect(r.page.mdast.type).toBe('root');
  });
  it('resolves a folder-index page via the xref data field', async () => {
    // /community's data is /community.index.json (folders: true site); URL-derived
    // guessing would fetch /community.json and 404. Fixture: page.community.json.
    const r = await resolvePage(`${jb.base}/community`);
    expect(r.page.mdast.type).toBe('root');
  });
  it('resolves a page on a site mounted under a subpath', async () => {
    const r = await resolvePage(`${mounted.base}/guide/interactive-notebooks#img-mpl`);
    expect(r.page.mdast.type).toBe('root');
  });
});
