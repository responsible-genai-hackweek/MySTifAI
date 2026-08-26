import { VFile } from 'vfile';
import { writeMd } from 'myst-to-md';
import { selectAll } from 'unist-util-select';
import type { Root } from './mdast.js';

/**
 * workaround: myst-to-md's container[figure] handler throws (unguarded label
 * access) when no image resolves; see docs/renderer-gaps.md for the full story.
 * This mirrors that handler exactly: it selects the FIRST non-placeholder
 * image (find, not some) and throws if that one lacks urlSource/url.
 */
function hasResolvableImage(node: any): boolean {
  const img = (selectAll('image', node) as any[]).find((i) => !i.placeholder);
  return Boolean(img?.urlSource || img?.url);
}

function guardThrowingContainers(node: any): any {
  if (node && typeof node === 'object') {
    if (node.type === 'container' && node.kind === 'figure' && !node.source && !hasResolvableImage(node)) {
      return { type: 'code', value: JSON.stringify(node) };
    }
    if (Array.isArray(node.children)) {
      node.children = node.children.map(guardThrowingContainers);
    }
  }
  return node;
}

/**
 * Render an mdast subtree (e.g. from `subsetByAnchor`) to markdown.
 *
 * Delegates to `myst-to-md`, which targets parsed mdast while deployed pages
 * serve post-transform mdast, so some node shapes render imperfectly or not
 * at all. Known cases and their fallbacks are in docs/renderer-gaps.md.
 * The input is not mutated.
 *
 * @returns The markdown plus any warnings `myst-to-md` emitted (one per
 *   node it couldn't fully render).
 */
export function renderMd(root: Root): { markdown: string; warnings: string[] } {
  const safeRoot = guardThrowingContainers(structuredClone(root));
  const file = new VFile();
  // myst-to-md pins its own (older) `vfile` version, so its `writeMd` types a
  // structurally-identical but nominally different VFile; cast at the boundary.
  writeMd(file as any, safeRoot as any);
  return {
    markdown: String(file.result ?? ''),
    warnings: file.messages.map((m) => m.message),
  };
}
