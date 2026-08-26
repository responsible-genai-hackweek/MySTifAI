# myst-docs

myst-docs gives terminals and LLM agents section-level access to any deployed MyST site, without the site changing anything.
It reads the same JSON endpoints a MyST site already publishes (`myst.xref.json`, per-page `.json`, `myst.search.json`) and lets you go from a site's outline, to a search over it, to the exact section you need, as markdown, rather than fetching and parsing whole pages.

## What works today

Run the CLI from a checkout of this repo with `npx tsx src/cli.ts`.

Paste any section link copied from your browser, and get that section back as markdown:

```bash
npx tsx src/cli.ts get 'https://mystmd.org/guide/quickstart#install-the-myst-markdown-cli'
```

Or give just the site root plus a MyST label, and it's found anywhere on the site, even on a different page than the one you gave:

```bash
npx tsx src/cli.ts get 'https://mystmd.org/guide#sunset-figure'
```

See a site's pages, or a page's headings and their anchors:

```bash
npx tsx src/cli.ts outline https://mystmd.org/guide
npx tsx src/cli.ts outline https://mystmd.org/guide /figures
```

List everything of one kind across a site, e.g. every figure with its identifier and `url#anchor`:

```bash
npx tsx src/cli.ts list figures https://mystmd.org/guide
```

Add `--format json` to `get` for the raw mdast instead of markdown.
`cache` shows how much is cached, `cache clear` empties it.

There is also a survey script that reports on the JSON endpoints a deployed site publishes:

```bash
npm run recon -- https://mystmd.org/guide
```

Everything is tested offline against fixtures captured from real MyST sites.

### As a library

The CLI is a thin wrapper over a small library. From a checkout of this repo, save this as `example.mts` and run it with `npx tsx example.mts`:

```typescript
import { subsetByAnchor } from './src/mdast.js';
import { renderMd } from './src/render.js';

const page = await (await fetch('https://mystmd.org/guide/quickstart.json')).json();
const section = subsetByAnchor(page.mdast, 'install-the-myst-markdown-cli');
console.log(renderMd(section).markdown);
```

## Roadmap

This is a hackweek project.
Still to come:

- CLI commands (`outline`, `get`, `search`, `list`) wrapping the library
- An MCP server exposing the same operations
- Agent skills (a `skills/` folder), once the CLI exists

## Project notes

The pages below record what we learned while building: recon findings, design decisions, and known renderer gaps.

- [](./recon-notes.md)
- [](./decisions.md)
- [](./renderer-gaps.md)

See [](./develop.md) for contributor conventions.
