/**
 * Cut sections out of a MyST page's mdast, as served by a deployed site's
 * per-page `.json` endpoint (the `mdast` field).
 */

/**
 * shortcut: permissive structural type instead of myst-spec's strict unions.
 * Deployed page JSON is post-transform AST with node types beyond the spec, and
 * strict types would force casts at every use. Revisit if we ever need
 * spec-typed traversal.
 */
type Node = { type: string; depth?: number; identifier?: string; html_id?: string; value?: string; children?: Node[] };
export type Root = { type: 'root'; children: Node[] };

export class AnchorNotFoundError extends Error {
  constructor(anchor: string) {
    super(`anchor not found: #${anchor}`);
    this.name = 'AnchorNotFoundError';
  }
}

/**
 * Unwrap one level of `block` nodes so headings become top-level siblings.
 *
 * Deployed page JSON always wraps content in `block` nodes exactly one level
 * deep (verified against the fixture sites).
 */
export function flattenBlocks(root: Root): Node[] {
  return root.children.flatMap((c) => (c.type === 'block' && c.children ? c.children : [c]));
}

/** All text values under a node, depth-first, whitespace-collapsed. */
export function textOf(node: Node): string {
  const acc: string[] = [];
  const collect = (n: Node) => {
    if (typeof n.value === 'string') acc.push(n.value);
    for (const c of n.children ?? []) collect(c);
  };
  collect(node);
  return acc.join(' ').replace(/\s+/g, ' ').trim();
}

function matches(n: Node, anchor: string): boolean {
  return n.type === 'heading' && (n.html_id === anchor || n.identifier === anchor);
}

// First node in tree order whose label matches; covers figures, tables,
// equations, and any other `(label)=` target.
function findByAnchor(n: Node, anchor: string): Node | undefined {
  if (n.html_id === anchor || n.identifier === anchor) return n;
  for (const c of n.children ?? []) {
    const hit = findByAnchor(c, anchor);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Return the part of a page identified by an anchor.
 *
 * A heading anchor yields its section: the heading plus everything after it,
 * up to (not including) the next heading of the same or shallower depth.
 * An anchor on any other labeled node (figure, table, equation, or a
 * `(label)=` target) yields just that node. Anchors are matched against
 * `html_id` and `identifier`, the same values used in the site's URLs and
 * `myst.xref.json`, so a browser URL fragment works directly.
 *
 * @param anchor - Anchor to resolve; omit to get the whole page (block-flattened).
 * @param opts.depth - Keep only this many levels of subsections below the
 *   anchor (0 = the anchor's own content only). Omit for the full subtree.
 * @throws If the anchor doesn't match any heading.
 */
export function subsetByAnchor(root: Root, anchor?: string, opts: { depth?: number } = {}): Root {
  const nodes = flattenBlocks(root);
  if (!anchor) return { type: 'root', children: nodes };
  const start = nodes.findIndex((n) => matches(n, anchor));
  if (start === -1) {
    // Not a section heading: resolve any other labeled node (figure, table,
    // equation, ...) to just that node.
    const node = findByAnchor({ type: 'root', children: nodes }, anchor);
    if (node) return { type: 'root', children: [node] };
    throw new AnchorNotFoundError(anchor);
  }
  const level = nodes[start].depth ?? 1;
  let end = nodes.length;
  for (let i = start + 1; i < nodes.length; i++) {
    if (nodes[i].type === 'heading' && (nodes[i].depth ?? 1) <= level) {
      end = i;
      break;
    }
  }
  let children = nodes.slice(start, end);
  if (opts.depth !== undefined) {
    // shortcut: cuts at the first too-deep heading; a too-deep subsection followed by an
    // allowed sibling would be wrongly truncated too. Revisit if a real page has that shape.
    const max = level + opts.depth;
    const cut = children.findIndex((n, i) => i > 0 && n.type === 'heading' && (n.depth ?? 1) > max);
    if (cut !== -1) children = children.slice(0, cut);
  }
  return { type: 'root', children };
}
