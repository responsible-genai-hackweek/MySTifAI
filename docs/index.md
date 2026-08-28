---
authors:
  - Chris Holdgraf
  - JP Swinski
  - Carlos E. Ugarte
  - Ellie Abrahams
  - Ian Carroll
---

# Up-skill your LLM Agents from MyST based Documentation using Progressive Disclosure

## Welcome

The specific aim is progressive disclosure for LLM agents: peek at a documentation site, then read it one relevant piece at a time, and never clobber your context.
A design goal is to force no changes on existing documentation.
The motivation for this project is two-fold:
1. reduce the complexity of reading documentation for LLM agents, to make lower-cost, lower-impact LLMs more effective
2. reduce the necessity of writing documentation for LLM agents as well as (or worse, instead of) for people

The project has two components:

**SKILLS.md** follows the skills-spec and is the "generalized" skill your agent will use to get started.

**docslice** gives command-line-tool access to sections of any deployed MyST site, for progressive disclosure of documentation.
Point it at a page URL and it prints just that section, as markdown.
It works by parsing the JSON data every MyST site already publishes.

## Quick Start

Try `docslice` in a terminal to get the "install-th-myst-markdown-cli" section of the MyST Guide.

```bash
npm install -g docslice
docslice get 'https://mystmd.org/guide/quickstart#install-the-myst-markdown-cli'
```

## Learn More

- **[docslice](./docslice.md)** — Full guide to installation, commands, and library usage
- **[Evaluation](./evaluation.md)** — Performance and design analysis
- **[Development](./develop.md)** — Setup, conventions, and how to contribute

## About This Project

This is a hackweek project. The codebase is open source, and contributions are welcome. 
See [Development](./develop.md) for setup and the conventions for working on the code.
