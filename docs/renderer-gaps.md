# Renderer gaps

These are node shapes that `myst-to-md` doesn't render cleanly, found by running our renderer over real deployed pages.
Each is a candidate upstream `mystmd` issue, paired with the fallback we use in the meantime.

`renderMd` (`src/render.ts`) delegates to `myst-to-md`'s `writeMd`, which targets parsed mdast.
Deployed page JSON is post-transform mdast, so some node shapes it never expected to see turn up.
This table is the tally from running `renderMd` over every heading-anchored section in `tests/fixtures/` (see the `round-trip` and `golden sections` blocks in `tests/render.test.ts`).

| Node type | Seen in | What myst-to-md does | Fallback | Upstream issue? |
| --- | --- | --- | --- | --- |
| `outputs` (notebook cell-output wrapper) | `mystmd-guide/page.interactive-notebooks.json` | Warns `Unsupported node type: outputs` and drops the whole subtree (children, e.g. `output`, are never visited) | None — output content is silently omitted from the markdown | Maybe — `myst-to-md` could special-case executed-notebook output the way it special-cases `container[kind=figure]`, since deployed sites always carry these |
| `container[kind=figure]` with no resolvable `image` node and no `source` field | `mystmd-guide/page.interactive-notebooks.json` (e.g. `#static-images`, `img:mpl`) | **Throws** (`Cannot read properties of undefined (reading 'label')`) — it does `` `#${node.source.label}` `` unguarded when no image is found | `renderMd` pre-pass (`guardThrowingContainers` in `src/render.ts`) swaps the whole container for `{type: 'code', value: JSON.stringify(node)}` before calling `writeMd`, so the section still renders instead of crashing. Ugly but visible; see the `#static-images` golden snapshot | Yes — the throw is a real bug independent of this project (unguarded property access), worth filing against `myst-to-md` |
| `myst` (raw passthrough source) | `mystmd-guide/page.website-style.json` | Warns `Unsupported node type: myst` and drops it | None — the node's `.value` field is actually already-valid MyST markdown, but per project rules gaps aren't patched inline, only documented | Maybe — a handler that emits `node.value` verbatim would be a natural, low-risk addition upstream |
| `grid` node child not recognized as `card` | `mystmd-guide/page..json`, `mystmd-guide/page.website-style.json`, `jupyterbook/*` (any page with a grid/card directive) | Warns `Unexpected grid node child is not card: undefined` (validator bug: checks `child.kind !== 'card'`, but card nodes carry `type: 'card'` and have no `kind` field, so this always fires) | None needed — rendering still succeeds despite the false-positive warning (see `#get-involved`, `#project-goals` golden snapshots) | Yes — validator checks the wrong field; harmless today but noisy and worth a small upstream fix |
| `tabSet` node child not recognized as `tabItem` | `mystmd-guide/page..json` (3 warnings in the sweep) — same validator pattern as `grid`/`card` (`child.kind !== 'tabItem'`) | Same false-positive warning as above | None needed | Same as `grid`/`card` |
| `embed` (resolved cross-project embed) | `mystmd-guide/page.website-style.json` (`#style-sheet` golden snapshot) | **Silent content loss, no warning**: the handler (`writeStaticDirective('embed', {argsKey: 'label'})`) ignores the node's resolved `children` (real prose) and reads `node.label`, but deployed AST stores it at `node.source.label` — output is a bare empty `` ```{embed} `` directive | None yet — invisible to the warning tally, found only by reading the golden snapshot against the fixture | Yes — worst gap found: silent loss of resolved content; handler should render `children` when present |

## Notes

- The `container[kind=figure]` throw is the only case in `src/render.ts` that needed a pre-pass; everything else is warning-only and already falls back to `''` inside `myst-to-md` itself.
- None of the fixture sections rendered to empty markdown even where these gaps occur — surrounding prose/headings kept the section non-empty.
  The `#static-images` golden snapshot is the one section where the gap fallback (a raw JSON dump) is the dominant visible content.
