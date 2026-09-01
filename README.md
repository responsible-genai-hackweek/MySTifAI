# docslice

[![npm](https://img.shields.io/npm/v/docslice)](https://www.npmjs.com/package/docslice)
[![docs](https://img.shields.io/badge/docs-MyST-blue)](https://responsible-genai-hackweek.github.io/MySTifAI/)

Section-level access to any deployed MyST site, for terminals and LLM agents.
Point it at a page URL and it prints just that section, as markdown.
It works from the JSON endpoints every MyST site already publishes, so sites don't need to change anything.
The aim is progressive disclosure to turn documentation into RAG resources for LLM agents: survey a docs site, then read it one section at a time, instead of stuffing whole pages into context.

## Get started

```bash
npm install -g docslice
docslice get 'https://mystmd.org/guide/quickstart#install-the-myst-markdown-cli'
```

## Documentation

The live documentation is here:

[🌐 responsible-genai-hackweek.github.io/MySTifAI/](https://responsible-genai-hackweek.github.io/MySTifAI/)

You can find the source for the documentation in [`docs/`](docs/index.md).
It is itself a MyST site.
Browse it locally with:

```
npm run docs:live
```
