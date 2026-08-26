# docslice

[![npm](https://img.shields.io/npm/v/docslice)](https://www.npmjs.com/package/docslice)
[![docs](https://img.shields.io/badge/docs-MyST-blue)](https://responsible-genai-hackweek.github.io/MySTifAI/)

Section-level access to any deployed MyST site, for terminals and LLM agents.
Point it at a page URL and it prints just that section, as markdown.
It works from the JSON endpoints every MyST site already publishes, so sites don't need to change anything.
The aim is progressive disclosure for LLM agents: survey a docs site, then read it one section at a time, instead of stuffing whole pages into context.

```bash
npm install -g docslice
docslice get 'https://mystmd.org/guide/quickstart#install-the-myst-markdown-cli'
```

This is a hackweek project.
Setup and usage are in [`docs/`](docs/index.md), which is itself a MyST site: browse it locally with `npm run docs:live`.

Contributor conventions and commands are in [`docs/develop.md`](docs/develop.md).
