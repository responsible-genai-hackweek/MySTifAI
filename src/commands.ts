/** The work behind each CLI command, returning data for cli.ts to print. */

import { openSite } from './site.js';
import { subsetByAnchor, flattenBlocks, textOf, AnchorNotFoundError, type Root } from './mdast.js';
import { searchPages } from './search.js';

/**
 * Resolve a URL's anchor to a subtree, falling back to a site-wide label
 * lookup when the anchor isn't on the pasted page itself. MyST labels are
 * site-global — the site index maps label -> page — so `get
 * <site-root>#<label>` works like MyST's own xref resolution, not just
 * anchors that happen to live on the given page.
 */
export async function getSection(url: string, depth?: number): Promise<Root> {
  const site = await openSite(url);
  const { mdast, anchor } = await site.page(url);
  try {
    return subsetByAnchor(mdast, anchor, { depth });
  } catch (err) {
    if (!anchor || !(err instanceof AnchorNotFoundError)) throw err;
    const other = await site.pageWithLabel(anchor);
    if (!other) throw err; // no site-wide match either: rethrow the original error
    try {
      return subsetByAnchor(other.mdast, anchor, { depth });
    } catch {
      throw err; // that page doesn't have it either: rethrow the original error
    }
  }
}

/**
 * Every page of a site: absolute URL plus title. Pages that failed to fetch
 * (e.g. a stale index entry) still get a row, just with an empty title,
 * rather than being silently dropped.
 */
export async function outlineSite(siteUrl: string): Promise<{ url: string; title: string }[]> {
  const site = await openSite(siteUrl);
  const titles = new Map((await site.allPageContent()).map((p) => [p.url, p.title]));
  return site.pages().map((url) => ({ url, title: titles.get(url) ?? '' }));
}

/** The anchored headings of one page (referenced by path or full URL), in order. */
export async function outlinePage(
  siteUrl: string,
  pageRef: string,
): Promise<{ text: string; anchor: string; depth: number }[]> {
  const site = await openSite(siteUrl);
  const { mdast } = await site.page(pageRef);
  return flattenBlocks(mdast)
    .filter((n) => n.type === 'heading' && (n.html_id || n.identifier))
    .map((n) => ({ text: textOf(n), anchor: (n.html_id ?? n.identifier)!, depth: n.depth ?? 1 }));
}

/**
 * Search a whole site: crawl every page and rank-search the lot.
 * `fetchedNone` flags a site whose index lists pages but none could be
 * fetched, so the caller can tell "no matches" from "nothing to search".
 */
export async function searchSite(
  siteUrl: string,
  query: string,
): Promise<{ hits: { url: string; snippet: string }[]; fetchedNone: boolean }> {
  const site = await openSite(siteUrl);
  const pages = await site.allPageContent();
  const results = await searchPages(pages, query);
  return {
    hits: results.map((h) => ({ url: h.url + (h.anchor ? '#' + h.anchor : ''), snippet: h.snippet })),
    fetchedNone: !pages.length && site.pages().length > 0,
  };
}
