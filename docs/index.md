# myst-docs

myst-docs gives terminals and LLM agents section-level access to any deployed MyST site, without the site changing anything.
It reads the same JSON endpoints a MyST site already publishes (`myst.xref.json`, per-page `.json`, `myst.search.json`) and lets you go from a site's outline, to a search over it, to the exact section you need, as markdown, rather than fetching and parsing whole pages.

## What works today

The core library fetches a MyST page's published JSON, cuts out one piece by its anchor, and renders it as markdown.
A heading anchor gives you that whole section; an anchor on any other labeled thing (a figure, table, or equation) gives you just that item.
From a checkout of this repo, save this as `example.mts` and run it with `npx tsx example.mts`:

```typescript
import { subsetByAnchor } from './src/mdast.js';
import { renderMd } from './src/render.js';

const page = await (await fetch('https://mystmd.org/guide/quickstart.json')).json();
const section = subsetByAnchor(page.mdast, 'install-the-myst-markdown-cli');
console.log(renderMd(section).markdown);
```

There is also a survey script that reports on the JSON endpoints a deployed site publishes:

```bash
npm run recon -- https://mystmd.org/guide
```

Everything is tested offline against fixtures captured from real MyST sites.

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
