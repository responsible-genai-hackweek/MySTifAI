process.env.DOCSLICE_CACHE = 'off';

import { describe, it, expect, afterAll } from 'vitest';
import { openSite, NotMystSiteError } from '../src/site.js';
import { NetworkError } from '../src/fetch.js';
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

describe('openSite', () => {
  it('finds the root for a page URL', async () => {
    const site = await openSite(`${guide.base}/interactive-notebooks`);
    expect(site.root).toBe(guide.base);
  });
  it('rejects with NetworkError when the host is unreachable', async () => {
    // Connection-level failure (nothing listening on port 1): every probe
    // fails before getting an HTTP response, so this is a network error,
    // not "not a MyST site".
    await expect(openSite('http://127.0.0.1:1/nope')).rejects.toBeInstanceOf(NetworkError);
  });
  it('throws NotMystSiteError when the host responds but has no site index', async () => {
    // Probes outside /guide get real 404s from the mounted server, so this
    // is genuinely "not a MyST site", not a network error.
    await expect(openSite(`${mounted.base}/nope`)).rejects.toThrow(NotMystSiteError);
  });
  it('finds the root for a site mounted under a subpath', async () => {
    const site = await openSite(`${mounted.base}/guide/interactive-notebooks`);
    expect(site.root).toBe(`${mounted.base}/guide`);
  });
});

describe('site.page', () => {
  it('resolves a page URL with fragment to mdast, title, and anchor', async () => {
    const site = await openSite(guide.base);
    const p = await site.page(`${guide.base}/interactive-notebooks#img-mpl`);
    expect(p.mdast.type).toBe('root');
    expect(p.anchor).toBe('img-mpl');
    expect(p.title).toBe('Generate and Display Rich Outputs');
  });
  it('resolves the site index page', async () => {
    const site = await openSite(jb.base);
    const p = await site.page(`${jb.base}/`);
    expect(p.mdast.type).toBe('root');
    expect(p.anchor).toBeUndefined();
  });
  it('accepts a root-relative or bare path instead of a full URL', async () => {
    const site = await openSite(jb.base);
    expect((await site.page('/community/team')).mdast.type).toBe('root');
    expect((await site.page('community/team')).mdast.type).toBe('root');
  });
  it('resolves a folder-index page via the index data field', async () => {
    // /community's data is /community.index.json (folders: true site); URL-derived
    // guessing would fetch /community.json and 404. Fixture: page.community.json.
    const site = await openSite(jb.base);
    expect((await site.page('/community')).mdast.type).toBe('root');
  });
  it('resolves a page on a site mounted under a subpath', async () => {
    const site = await openSite(`${mounted.base}/guide`);
    const p = await site.page(`${mounted.base}/guide/interactive-notebooks#img-mpl`);
    expect(p.mdast.type).toBe('root');
    expect(p.anchor).toBe('img-mpl');
  });
});

describe('site.pageWithLabel', () => {
  it('finds the page holding a site-global label', async () => {
    const site = await openSite(guide.base);
    const p = await site.pageWithLabel('img-mpl');
    expect(p?.url).toBe(`${guide.base}/interactive-notebooks`);
  });
  it('returns undefined for an unknown label', async () => {
    const site = await openSite(guide.base);
    expect(await site.pageWithLabel('no-such-label')).toBeUndefined();
  });
});
