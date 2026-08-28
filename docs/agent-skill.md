# Agent Skill

The skill teaches LLM agents to efficiently access MyST documentation sites through progressive disclosure.

## What it does

`docslice` pulls sections out of any deployed MyST site as markdown, enabling agents to survey a site cheaply and then read only the sections they actually need—already converted to markdown.

## The workflow

Agents follow a survey-locate-retrieve loop:

1. **Survey**: `docslice get <site-root>` — learn what the site is about
2. **Locate**: Use `docslice outline` to list pages and headings, or `docslice search` to find relevant sections
3. **Retrieve**: `docslice get '<url>#<anchor>'` — fetch just that section as markdown

## Key commands

- `docslice outline <site>` — list all pages on a site
- `docslice outline <site> <page>` — list a page's headings and anchors
- `docslice search <site> "<phrase>"` — find sections mentioning a phrase
- `docslice get '<url>#<anchor>'` — get that section as markdown (omit `#anchor` for the whole page)

## Installation

If `docslice` isn't on your PATH, run it as `npx docslice`, or from a checkout of this repo as `npx tsx src/cli.ts`.

## Learning more

The skill is designed to teach just the essentials and point agents back to the tool itself. Agents can explore the project's own documentation using these same commands:

```bash
docslice search https://responsible-genai-hackweek.github.io/MySTifAI "cache"
docslice get 'https://responsible-genai-hackweek.github.io/MySTifAI/develop#running-things'
```

This keeps the skill minimal and lets the tool's documentation stay the single source of truth.
