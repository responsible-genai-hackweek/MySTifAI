/**
 * A deployed MyST site, opened from any of its URLs.
 *
 * This is the only module that reads `myst.xref.json` records: a page's data
 * URL always comes from the record's `data` field, never derived from the URL
 * (derivation breaks on folder-index pages; docs/decisions.md), and every URL
 * handed back is absolute so it feeds straight into `get`.
 */

import { fetchJson, NetworkError } from './fetch.js';

const HOUR_MS = 60 * 60 * 1000;

export class NotMystSiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotMystSiteError';
  }
}

export class PageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageNotFoundError';
  }
}

/** A fetched page: absolute URL, frontmatter title ('' if none), and mdast. */
export type Page = { url: string; title: string; mdast: any };

export type Site = {
  /** The site root URL, without a trailing slash. */
  root: string;
  /** Absolute URL of every page, in site-index order. */
  pages(): string[];
  /**
   * Fetch one page, referenced by absolute URL or (root-relative) path; a
   * `#fragment` on either form is returned decoded as `anchor`.
   * @throws PageNotFoundError if the site index has no such page.
   */
  page(ref: string): Promise<Page & { anchor?: string }>;
  /** Fetch the page holding a site-global label, or undefined if none does. */
  pageWithLabel(anchor: string): Promise<Page | undefined>;
  /** Identifier and absolute `url#anchor` of every index record of one kind (figure, table, ...). */
  labels(kind: string): { identifier?: string; url: string }[];
  /** Fetch every page's content; pages that fail to fetch are skipped. */
  allPageContent(): Promise<Page[]>;
};

/**
 * Find the MyST site containing `rawUrl` by probing for myst.xref.json,
 * deepest path first (handles sites deployed under subpaths, and multiple
 * independent sites on one domain — see docs/decisions.md).
 */
export async function openSite(rawUrl: string): Promise<Site> {
  const { root, xref } = await findSiteRoot(new URL(rawUrl));
  const rootPath = new URL(root).pathname.replace(/\/$/, '');

  const pageRecords = () => xref.references.filter((r: any) => r.kind === 'page');
  async function fetchPage(rec: any): Promise<Page> {
    const data = await fetchJson(rec.data.startsWith('http') ? rec.data : root + rec.data);
    return { url: root + rec.url, title: data.frontmatter?.title ?? '', mdast: data.mdast };
  }

  return {
    root,
    pages: () => pageRecords().map((r: any) => root + r.url),

    async page(ref: string) {
      // Plain concatenation for path refs, not `new URL(ref, root)`: URL
      // resolution would drop any subpath the site is deployed under.
      const url = /^https?:\/\//.test(ref)
        ? new URL(ref)
        : new URL(root + (ref.startsWith('/') ? '' : '/') + ref);
      const pagePath = url.pathname.slice(rootPath.length).replace(/\/$/, '') || '/';
      const rec = pageRecords().find((r: any) => r.url === pagePath);
      if (!rec) throw new PageNotFoundError(`no page ${pagePath} in ${root}/myst.xref.json`);
      return { ...(await fetchPage(rec)), anchor: decodeAnchor(url.hash) };
    },

    async pageWithLabel(anchor: string) {
      const rec = xref.references.find((r: any) => r.identifier === anchor || r.html_id === anchor);
      return rec && (await fetchPage(rec));
    },

    labels: (kind: string) =>
      xref.references
        .filter((r: any) => r.kind === kind)
        .map((r: any) => {
          const anchor = r.html_id ?? r.identifier;
          return { identifier: r.identifier, url: `${root}${r.url}${anchor ? '#' + anchor : ''}` };
        }),

    // Fetch a handful at a time so a large site doesn't open dozens of
    // connections at once. A page that fails to fetch (e.g. a stale index
    // entry) is skipped rather than failing the whole crawl.
    async allPageContent() {
      const records = pageRecords();
      const CONCURRENCY = 8;
      const pages: Page[] = [];
      for (let i = 0; i < records.length; i += CONCURRENCY) {
        const fetched = await Promise.allSettled(records.slice(i, i + CONCURRENCY).map(fetchPage));
        for (const res of fetched) {
          if (res.status === 'fulfilled') pages.push(res.value);
        }
      }
      return pages;
    },
  };
}

async function findSiteRoot(url: URL): Promise<{ root: string; xref: any }> {
  const segments = url.pathname.split('/').filter(Boolean);
  // Track whether any probe actually reached the server (got an HTTP
  // response, even a 404) vs. every probe failing at the connection level
  // (DNS, refused, etc.) — those are different failures: "not a MyST site"
  // vs. "network error", and the CLI maps them to different exit codes.
  let sawHttp = false;
  let lastErr: unknown;
  for (let i = segments.length; i >= 0; i--) {
    const root = url.origin + (i ? '/' + segments.slice(0, i).join('/') : '');
    try {
      const xref = await fetchJson(`${root}/myst.xref.json`, HOUR_MS);
      if (Array.isArray(xref?.references)) return { root, xref };
    } catch (e) {
      // Anything but a connection failure (an HTTP error, or non-JSON like
      // an SPA fallback page) means the server responded.
      if (!(e instanceof NetworkError)) sawHttp = true;
      lastErr = e;
    } // keep walking up
    // shortcut: failed probes aren't cached; revisit if deep paths feel slow.
  }
  if (!sawHttp && lastErr) throw lastErr;
  throw new NotMystSiteError(
    `no myst.xref.json found at ${url.origin}${url.pathname} or any parent path — this may not be a MyST site`,
  );
}

/** Browser-pasted fragments arrive percent-encoded (e.g. #sec-caf%C3%A9). */
function decodeAnchor(hash: string): string | undefined {
  if (!hash) return undefined;
  const raw = hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // malformed escape (e.g. a lone %); fall back to the raw hash
  }
}
