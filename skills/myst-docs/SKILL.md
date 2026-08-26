---
name: myst-docs
description: Read any deployed MyST documentation site from the command line, one section at a time. Use when you need content from a MyST site (MyST guide, Jupyter Book sites, and similar) without fetching and parsing whole pages.
---

# myst-docs

`myst-docs` pulls sections out of any deployed MyST site as markdown.
Use it for progressive disclosure: survey a site cheaply, then read only the sections you actually need, already converted to markdown.
Never fetch and parse whole pages of a MyST site when this tool is available.

If `myst-docs` isn't on your PATH, run it as `npx myst-docs`, or from a checkout of this repo as `npx tsx src/cli.ts`.

## The loop

Survey, locate, retrieve.
On an unfamiliar site, start with `myst-docs get <site-root>` to learn what the site is about, then:

```bash
myst-docs outline <site>            # list the site's pages
myst-docs outline <site> <page>     # list one page's headings and anchors
myst-docs search <site> "<phrase>"  # find sections mentioning a phrase
myst-docs get '<url>#<anchor>'      # print that section as markdown
```

Addresses are plain URLs: `search` and `outline` print `url#anchor` values that feed straight into `get`.
The anchor can be any MyST label on the site, not just one from the page you name.
Omit the `#anchor` to print a whole page.
`search` matches plain substrings, case-insensitively, so short queries can match inside unrelated words.
Exit codes: 0 ok, 1 no results, 2 not a MyST site, 3 network error.
A `warning:` on stderr means part of a section didn't convert; the markdown on stdout is still usable.

## Learn the rest from the tool itself

This project's own docs are a MyST site.
Query them with the commands above instead of guessing:

```bash
myst-docs search https://responsible-genai-hackweek.github.io/MySTifAI "cache"
myst-docs get 'https://responsible-genai-hackweek.github.io/MySTifAI/develop#running-things'
```
