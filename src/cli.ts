#!/usr/bin/env node
import { Command } from 'commander';
import { cacheStatus, cacheClear } from './fetch.js';
import { openSite, NotMystSiteError, PageNotFoundError } from './site.js';
import { AnchorNotFoundError } from './mdast.js';
import { renderMd } from './render.js';
import { getSection, outlineSite, outlinePage, searchSite } from './commands.js';

const program = new Command().name('docslice');

// Exit codes per docs/develop.md: 0 ok, 1 no results, 2 not a MyST site, 3 network error.
function fail(err: unknown): never {
  console.error(err instanceof Error ? err.message : String(err));
  if (err instanceof NotMystSiteError) process.exit(2);
  if (err instanceof PageNotFoundError || err instanceof AnchorNotFoundError) process.exit(1);
  // everything else (HttpError, NetworkError, bugs): 3
  process.exit(3);
}

program
  .command('get <url>')
  .description(
    'print the section (or labeled node) a URL#anchor points at, as markdown; the anchor may be any label on the site, and omitting it prints the whole page',
  )
  .option('--depth <n>', 'levels of subsections to include', (v: string) => {
    // commander calls the coercion fn as (value, previous) — bare parseInt
    // would take `previous` as its radix argument, so wrap it.
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) program.error('--depth must be a number');
    return n;
  })
  .option('--format <fmt>', 'md | json', 'md')
  .action(async (url: string, opts: { depth?: number; format: string }) => {
    try {
      const subtree = await getSection(url, opts.depth);
      if (opts.format === 'json') {
        console.log(JSON.stringify(subtree, null, 1));
      } else {
        const { markdown, warnings } = renderMd(subtree);
        for (const w of warnings) console.error(`warning: some content didn't convert to markdown (${w})`);
        console.log(markdown);
      }
    } catch (err) {
      fail(err);
    }
  });

program
  .command('outline <site> [page]')
  .description("list a site's pages, or a page's headings with anchors")
  .action(async (site: string, pageRef?: string) => {
    try {
      if (!pageRef) {
        for (const row of await outlineSite(site)) console.log(`${row.url}\t${row.title}`);
        return;
      }
      const headings = await outlinePage(site, pageRef);
      for (const h of headings) console.log(`${'  '.repeat(h.depth - 1)}${h.text} #${h.anchor}`);
      // An empty outline looks identical to a failed call otherwise.
      if (!headings.length) console.error(`no anchored headings on ${pageRef}; try \`get\` for the whole page`);
    } catch (err) {
      fail(err);
    }
  });

program
  .command('search <site> <query>')
  .description('search all pages of a site for a phrase')
  .action(async (site: string, query: string) => {
    try {
      const { hits, fetchedNone } = await searchSite(site, query);
      if (fetchedNone) console.error('warning: no pages could be fetched');
      if (!hits.length) {
        console.error(`no matches for "${query}"`);
        process.exit(1);
      }
      const SHOWN = 20;
      if (hits.length > SHOWN) {
        console.error(`showing ${SHOWN} of ${hits.length} matches; refine the query to narrow`);
      }
      for (const h of hits.slice(0, SHOWN)) console.log(`${h.url}\t${h.snippet}`);
    } catch (err) {
      fail(err);
    }
  });

program
  .command('list <kind> <site>')
  .description('list figures | tables | headings | pages from the site index')
  .action(async (kind: string, siteUrl: string) => {
    try {
      const site = await openSite(siteUrl);
      // shortcut: identifier<TAB>url#anchor output, no captions — those would
      // require fetching every page; defer until someone needs them.
      const rows = site.labels(kind.replace(/s$/, ''));
      if (!rows.length) {
        console.error(`no ${kind} in site index`);
        process.exit(1);
      }
      for (const r of rows) console.log(`${r.identifier ?? '(no id)'}\t${r.url}`);
    } catch (err) {
      fail(err);
    }
  });

program
  .command('cache [action]')
  .description('status (default) | clear')
  .action((action?: string) => {
    if (action === 'clear') {
      cacheClear();
      console.error('cache cleared');
      return;
    }
    const s = cacheStatus();
    console.log(`${s.files} files, ${(s.bytes / 1024).toFixed(0)} KB in ${s.dir}`);
  });

program.parseAsync().catch(fail);
