# Decisions

Findings that changed our design assumptions, newest last.
See [](./recon-notes.md) for full detail behind each one.

- Tests run against fixtures captured from live MyST sites (`tests/fixtures/`, saved by `scripts/recon.ts`) rather than synthetic data or live-network calls: offline and deterministic, while still proving the code works on what real deployments actually serve. `scripts/recon.ts` is temporary and goes away once the CLI can inspect sites itself.
- The slash→dot URL→`data` derivation rule fails for folder-index pages (e.g. `/community/jobs` → `/community.jobs.index.json`, not `/community.jobs.json`); the xref `data` field must always be used as the source of truth, never derived.
- xref heading records include an `implicit` boolean field beyond the assumed `kind`/`url`/`data` shape.
- `myst.search.json` records are Algolia DocSearch-style (`hierarchy`, `type`, `url`, `position`, and `content` on content-type rows), richer than the bare page/heading pointer shape assumed in the design spec.
- `next.jupyterbook.org` was unreachable (connection timeout) during Phase 0 recon; `https://jupyterbook.org` was surveyed instead as the second required site.
- The bare `mystmd.org` domain (no subpath) 404s on `myst.xref.json`: each documentation section (`/guide`, `/spec`, `/jtex`) is its own independent MyST site deployment.
- `scripts/recon.ts` has been retired now that the CLI can inspect sites directly.
- `myst.search.json` is deliberately unused by `search`: it only exists on static-export hosting, and deriving records from page JSONs gives identical behavior on every site.
- `search` and `get` define sections differently on purpose: `search` treats every anchored heading as a flat boundary, while `get` follows heading depth so a section includes its subsections. A search hit points at the nearest anchor, and `get` on that anchor retrieves it with its subtree.
- All `myst.xref.json` interpretation lives in `src/site.ts` (`openSite`): nothing outside it reads xref records or joins `data` URLs, so a change in the index format touches one file. The same duplication kept reappearing in commands before this rule.
