---
authors:
  - Chris Holdgraf
  - JP Swinski
  - Carlos E. Ugarte
  - Ellie Abrahams
  - Ian Carroll
---

# Enhance LLM output by turning your MyST site into a RAG resource with progressive disclosure

This project allows you to convert a site built with the [MyST Document Engine](https://mystmd.org) into a resource that LLMs can **index, search, and retrieve**.
MyST modularizes its content into machine-readable chunks, and this tool allows you to **return parts of a MyST site as markdown** for the LLM to learn from.

## Why this project exists

Many LLMs benefit from [Retrieval Augmented Generation](https://aws.amazon.com/what-is/retrieval-augmented-generation/) to improve their outputs.
This is especially useful for smaller or open-weights LLMs whose context quickly degrades as it fills up.
While it's possible to throw Opus/Fable/Astra at many problems, these models are inaccessible to many now and in the future.
Smaller models need more guidance, but are more accessible and robust to long-term changes in the ecosystem.
This project aims to make them more useful by more efficiently parsing knowledge bases written with the MyST engine.

The motivation for this project is two-fold:
1. reduce the complexity of reading documentation for LLM agents, to make lower-cost, lower-impact LLMs more effective
2. reduce the necessity of writing documentation for LLM agents _instead of_ writing for people

A design goal is to force no changes on existing documentation.
We want to leverage pre-existing community practices to enhance LLM workflows, rather than to make people change their behavior for LLMs.

## How it works

The [MyST AST](https://mystmd.org/spec/ast-primer) encodes the content of any document as a modular, machine-readable `.json` file.
It also publishes index files that make it easier for machines to discover the structure and metadata across a site built with MyST.

This project builds a command-line tool that leverages this structure to help an LLM more effectively parse and use the information in a community site, turning documentation into a resource that LLMs can learn from and re-use without polluting their context with too much tokens.

The project has two components:

**docslice** gives command-line-tool access to sections of any deployed MyST site, for progressive disclosure of documentation.
Point it at a page URL and it prints just that section, as markdown.
It works by parsing the JSON data every MyST site already publishes.

**SKILLS.md** follows the skills-spec and is the "generalized" skill your agent will use to get started.


## Quick Start

Try `docslice` in a terminal to get the "install-the-myst-markdown-cli" section of the MyST Guide.

```bash
npm install -g docslice
docslice get 'https://mystmd.org/guide/quickstart#install-the-myst-markdown-cli'
```

## Learn More

- **[Agent skill](./agent-skill.md)** — The skill file that teaches agents the tool
- **[docslice](./docslice.md)** — Full guide to installation, commands, and library usage
- **[Evaluation](./evaluation.md)** — Performance and design analysis
- **[Development](./develop.md)** — Setup, conventions, and how to contribute


## Acknowledgements

This repository was created as part of the [Responsible GenAI for NASA Earth Data Hackweek in 2026](https://responsible-genai.hackweek.io/).
