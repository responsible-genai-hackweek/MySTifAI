/**
 * Ranked search over a MyST site's pages, reusing the theme's own search
 * stack so CLI results match what the site's search UI would show.
 */

import { flattenBlocks, textOf } from './mdast.js';
import type { SearchRecord, RankedSearchResult, HeadingLevel } from '@myst-theme/search';
import { SEARCH_ATTRIBUTES_ORDERED, rankResults } from '@myst-theme/search';
import { createSearch } from '@myst-theme/search-minisearch';

const SNIPPET_PAD = 60; // chars either side of the match; ~120 chars total

// Minisearch options, mirrored from myst-theme's own site (themes/book/app/root.tsx):
// index every hierarchy level plus content, store enough fields to render a
// result, and turn on prefix + fuzzy matching so partial and typo'd terms hit.
const SEARCH_OPTIONS = {
  fields: SEARCH_ATTRIBUTES_ORDERED as unknown as string[],
  storeFields: ['hierarchy', 'content', 'url', 'type', 'id', 'position'],
  idField: 'id',
  searchOptions: {
    fuzzy: 0.2,
    prefix: true,
  },
};

// The upstream engine ANDs every query token together (see `combineResults`
// in @myst-theme/search-minisearch): each extra word only narrows the
// result set further, so "how do I cite a paper" would require "how", "do",
// and "a" to all appear in the same indexed section. Stripping common
// stopwords before searching keeps question-style queries useful without
// touching the shared indexing or ranking.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'is', 'are', 'do', 'does', 'how', 'what', 'when',
  'where', 'why', 'can', 'could', 'should', 'would', 'to', 'of', 'in', 'on',
  'for', 'with', 'my', 'you',
]);

function stripStopwords(query: string): string {
  const kept = query.split(/\s+/).filter((t) => t && !STOPWORDS.has(t.toLowerCase()));
  return kept.length ? kept.join(' ') : query; // an all-stopword query searches unchanged
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function headingLevel(depth: number | undefined): HeadingLevel {
  return `lvl${Math.min(Math.max(depth ?? 1, 1), 6)}` as HeadingLevel;
}

/**
 * Split a page into the same {hierarchy, type, url, position, content}
 * records `myst build` writes into myst.search.json, so ranking behaves the
 * way the site's own search does.
 *
 * A section is the content from one anchored heading up to the next
 * (headings without an anchor don't start a new section — same rule
 * `subsetByAnchor` in mdast.ts uses); content before the first anchored
 * heading is the page's own section. Each section yields a heading record
 * (matched via `hierarchy`) and a content record (matched via `content`).
 *
 * `hierarchy.lvl1` is the page's frontmatter title when the caller has one
 * (a page's mdast doesn't carry it), falling back to the page's first
 * heading, or its url if it has neither.
 */
function buildRecords(url: string, mdast: any, title?: string): SearchRecord[] {
  const nodes = flattenBlocks(mdast);
  const firstHeading = nodes.find((n: any) => n.type === 'heading');
  const pageTitle = title || (firstHeading && textOf(firstHeading)) || url;

  // path[d - 1] holds the current ancestor heading text at depth d.
  const path: (string | undefined)[] = [pageTitle, undefined, undefined, undefined, undefined, undefined];
  const records: SearchRecord[] = [];
  let position = 0;
  let anchor: string | undefined;
  let currentType: HeadingLevel = 'lvl1';
  let acc: string[] = [];

  const flush = () => {
    const content = collapse(acc.join(' '));
    const hierarchy = { lvl1: path[0], lvl2: path[1], lvl3: path[2], lvl4: path[3], lvl5: path[4], lvl6: path[5] };
    const recordUrl = anchor ? `${url}#${anchor}` : url;
    records.push({ hierarchy, type: currentType, url: recordUrl, position: position++ });
    records.push({ hierarchy, type: 'content', content, url: recordUrl, position: position++ });
    acc = [];
  };

  for (const n of nodes) {
    if (n.type === 'heading' && (n.html_id || n.identifier)) {
      flush();
      const depth = Math.min(Math.max(n.depth ?? 1, 1), 6);
      anchor = n.html_id ?? n.identifier;
      currentType = headingLevel(depth);
      path[depth - 1] = textOf(n);
      for (let d = depth; d < 6; d++) path[d] = undefined; // a new heading supersedes deeper ancestors
      continue; // heading text feeds `hierarchy`, not `content`
    }
    // shortcut: an anchor-less heading doesn't start a section, but its text
    // still counts as content of whichever section it falls in.
    acc.push(textOf(n));
  }
  flush();
  return records;
}

function recordText(r: RankedSearchResult): string {
  if (r.type === 'content') return (r as any).content ?? '';
  return (r.hierarchy as any)[r.type] ?? '';
}

/** ~120-char, whitespace-collapsed window around the first matched term. */
function snippetAround(text: string, terms: string[]): string {
  const collapsed = collapse(text);
  const lower = collapsed.toLowerCase();
  let idx = -1;
  let matchLen = 0;
  for (const term of terms) {
    const i = lower.indexOf(term.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) {
      idx = i;
      matchLen = term.length;
    }
  }
  if (idx === -1) return collapsed.slice(0, SNIPPET_PAD * 2);
  const start = Math.max(0, idx - SNIPPET_PAD);
  const end = Math.min(collapsed.length, idx + matchLen + SNIPPET_PAD);
  return collapsed.slice(start, end);
}

/**
 * Rank-search a site's pages for `query`.
 *
 * Builds DocSearch-shaped records per page (see `buildRecords`), indexes
 * them with minisearch via `@myst-theme/search-minisearch`'s `createSearch`,
 * and ranks hits with `@myst-theme/search`'s `rankResults` (the same
 * Algolia-derived ranking the theme's own search UI uses) — headings rank
 * above body content, exact/positional matches rank above fuzzy ones.
 */
export async function searchPages(
  pages: { url: string; title?: string; mdast: any }[],
  query: string,
): Promise<{ url: string; anchor?: string; snippet: string }[]> {
  const records = pages.flatMap((p) => buildRecords(p.url, p.mdast, p.title));
  const search = createSearch(records, SEARCH_OPTIONS);
  const results = await search(stripStopwords(query));
  if (!results) return [];
  const ranked = rankResults(results)
    // A section's heading and content records (and duplicate anchors) can
    // both match; keep only the top-ranked hit per url, same as the
    // theme's own search UI (packages/site/.../Navigation/Search.tsx).
    .filter((r, i, arr) => r.url !== arr[i - 1]?.url);
  return ranked.map((r) => {
    const terms = r.queries.flatMap((q) => Object.keys(q.matches));
    const [url, anchor] = r.url.split('#');
    return { url, anchor, snippet: snippetAround(recordText(r), terms) };
  });
}
