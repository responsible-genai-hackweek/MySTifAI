# Developing myst-docs

How to get set up, and the conventions for working on this codebase.

## Running things

First-time setup, from a checkout:

```bash
npm install
```

Run the tests and the typecheck:

```bash
npm test
npx tsc --noEmit
```

Try the CLI straight from your working tree.
There's no build step here, so this always runs your latest changes:

```bash
npx tsx src/cli.ts get 'https://mystmd.org/guide/quickstart#install-the-myst-markdown-cli'
```

Build the installed `myst-docs` command (it runs `dist/`, so it lags behind your edits until you rebuild):

```bash
npm run build
```

Work on the docs site:

```bash
npm run docs:live   # live-reloading preview
npm run docs        # one-shot build
```

## Design conventions

**Consume published JSON, never reparse markdown source.**
A deployed MyST site already serves parsed AST (page `.json`, `myst.xref.json`, `myst.search.json`).
Reparsing markdown would duplicate work the site has already done, and risks drifting from what it actually rendered.

**Prefer reusing mystmd/myst-theme packages over reimplementing.**
`myst-to-md`, `@myst-theme/search`, `@myst-theme/search-minisearch`, and `myst-spec-ext` types cover most of what this project needs.
Local checkouts for API reference: `~/github/jupyter/book/mystmd` and `~/github/jupyter/book/myst-theme`.

**Resolve page-JSON URLs via the `data` field in `myst.xref.json`.**
Deriving a URL from the page path (slashes to dots) looks right most of the time, but breaks for folder-index pages; see the derivation-rule section in [](./recon-notes.md).
Treat derivation as a fallback only.

**Route all network fetches through `src/fetch.ts`.**
One caching layer means one place to reason about retries, caching, and offline tests.
No bare `fetch()` elsewhere.

**Tests run offline, against `tests/fixtures/`.**
`npm test` must pass with no network access.
This keeps CI fast and deterministic, and keeps the fixtures themselves as a record of what real sites actually return.
Refresh fixtures by curling a site's `myst.xref.json` and page `data` URLs into `tests/fixtures/<site>/`, named `myst.xref.json` and `page<url-with-slashes-as-dots>.json`.

**stdout is the payload, stderr is diagnostics.**
So the CLI composes cleanly in a pipeline. Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | ok |
| 1 | no results |
| 2 | not a MyST site |
| 3 | network error |

**Markdown out by default; `--format json` is the escape hatch.**
Markdown is what both terminals and LLMs read most naturally; JSON stays available for callers that need structure.

**Renderer gaps get documented, not patched inline.**
When `myst-to-md` can't handle a node shape, add it to [](./renderer-gaps.md) with a graceful fallback rather than patching `myst-to-md` behavior locally.
This keeps gaps visible and fixable upstream instead of silently diverging.
