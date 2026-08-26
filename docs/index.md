# myst-docs

myst-docs gives terminals and LLM agents section-level access to any deployed MyST site, without the site changing anything.
It reads the JSON endpoints every MyST site already publishes, so you can pull out one section as markdown instead of fetching and parsing whole pages.

The goal is progressive disclosure for agents.
A docs site is already a structured knowledge base, and this tool lets an agent survey it, then read just the sections it needs, keeping context small.
That matters most for smaller and open-weights models, which can't absorb whole sites.
And because the site is queried directly, nobody maintains a separate set of agent-facing skill files: the docs stay the single source of truth.

## Setup

From a checkout of this repo, install the `myst-docs` command once:

```bash
npm install && npm run build && npm link
```

## Using it

Paste any section link copied from your browser, and get that section back as markdown:

```bash
myst-docs get 'https://mystmd.org/guide/quickstart#install-the-myst-markdown-cli'
```

Leave off the `#anchor` to print the whole page.
You can also give the site root plus any MyST label, and myst-docs finds it wherever it lives on the site:

```bash
myst-docs get 'https://mystmd.org/guide#sunset-figure'
```

See a site's pages, or one page's headings and their anchors:

```bash
myst-docs outline https://mystmd.org/guide
myst-docs outline https://mystmd.org/guide /figures
```

List everything of one kind across a site, like every figure:

```bash
myst-docs list figures https://mystmd.org/guide
```

Search every page of a site for a phrase:

```bash
myst-docs search https://mystmd.org/guide "kernelspec"
```

The first search on a site fetches every page, so it's slower; later searches reuse the cache.

Add `--format json` to `get` for the raw mdast instead of markdown, or `--depth 0` to trim a section down to just its own content, without subsections.
A `warning:` line on stderr means myst-docs couldn't convert part of the content to markdown; [](./renderer-gaps.md) tracks these cases.
Fetches are cached for a day under `~/.cache/myst-docs`; `myst-docs cache` shows what's stored, and `myst-docs cache clear` forces fresh fetches.

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

- An MCP server exposing the same operations

There is a skill teaching LLM agents to use the CLI in [`skills/myst-docs/`](https://github.com/responsible-genai-hackweek/MySTifAI/blob/main/skills/myst-docs/SKILL.md).
It stays small on purpose: it teaches the commands and points agents at this site to learn the rest with the tool itself.

## Project notes

The pages below record what we learned while building: recon findings, design decisions, and known renderer gaps.

- [](./recon-notes.md)
- [](./decisions.md)
- [](./renderer-gaps.md)

See [](./develop.md) for contributor conventions.
