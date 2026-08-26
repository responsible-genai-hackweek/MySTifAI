/** Case-insensitive substring search over a MyST site's pages, section by section. */

import { flattenBlocks } from './mdast.js';

const SNIPPET_PAD = 40; // chars either side of the match; ~80 chars total

function collectText(node: any, acc: string[]): void {
  if (typeof node.value === 'string') acc.push(node.value);
  for (const c of node.children ?? []) collectText(c, acc);
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Search each page for `query`, section by section.
 *
 * A section is the text from one anchored heading up to the next (headings
 * without an anchor don't start a new section); content before the first
 * anchored heading is its own, anchor-less section. A section matches if its
 * concatenated text contains `query`, case-insensitively.
 */
export function searchPages(
  pages: { url: string; mdast: any }[],
  query: string,
): { url: string; anchor?: string; snippet: string }[] {
  const q = collapse(query).toLowerCase();
  const hits: { url: string; anchor?: string; snippet: string }[] = [];
  for (const page of pages) {
    let anchor: string | undefined;
    let acc: string[] = [];
    const flush = () => {
      const text = collapse(acc.join(' '));
      const idx = text.toLowerCase().indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - SNIPPET_PAD);
        const end = Math.min(text.length, idx + query.length + SNIPPET_PAD);
        hits.push({ url: page.url, anchor, snippet: text.slice(start, end) });
      }
      acc = [];
    };
    for (const n of flattenBlocks(page.mdast)) {
      if (n.type === 'heading' && (n.html_id || n.identifier)) {
        flush();
        anchor = n.html_id ?? n.identifier;
      }
      collectText(n, acc);
    }
    flush();
  }
  return hits;
}
