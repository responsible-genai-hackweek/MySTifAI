#!/usr/bin/env node
import { Command } from 'commander';
import { fetchJson, cacheStatus, cacheClear } from './fetch.js';
import { findSiteRoot, resolvePage, NotMystSiteError, PageNotFoundError } from './resolve.js';
import { subsetByAnchor, flattenBlocks, type Root } from './mdast.js';
import { renderMd } from './render.js';
import { searchPages } from './search.js';

const program = new Command().name('myst-docs');

// Exit codes per docs/develop.md: 0 ok, 1 no results, 2 not a MyST site, 3 network error.
function fail(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  if (err instanceof NotMystSiteError) process.exit(2);
  if (err instanceof PageNotFoundError) process.exit(1);
  if (/anchor not found/.test(msg)) process.exit(1);
  // everything else (HttpError, fetch TypeError, bugs): 3
  process.exit(3);
}

/**
 * Resolve a URL's anchor to a subtree, falling back to a site-wide label
 * lookup when the anchor isn't on the pasted page itself. MyST labels are
 * site-global — myst.xref.json maps identifier -> page — so `get
 * <site-root>#<label>` should work like MyST's own xref resolution, not
 * just anchors that happen to live on the given page.
 */
async function resolveSection(url: string, depth?: number): Promise<Root> {
  const { root, xref, page, anchor } = await resolvePage(url);
  try {
    return subsetByAnchor(page.mdast, anchor, { depth });
  } catch (err) {
    if (!anchor || !/anchor not found/.test((err as Error).message)) throw err;
    const rec = xref.references.find((r: any) => r.identifier === anchor || r.html_id === anchor);
    if (!rec) throw err; // no site-wide match either: rethrow the original error
    const otherPage = await fetchJson(rec.data.startsWith('http') ? rec.data : root + rec.data);
    try {
      return subsetByAnchor(otherPage.mdast, anchor, { depth });
    } catch {
      throw err; // that page doesn't have it either: rethrow the original error
    }
  }
}

program
  .command('get <url>')
  .description(
    'print the section (or labeled node) a URL#anchor points at, as markdown; the anchor may be any label on the site',
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
      const subtree = await resolveSection(url, opts.depth);
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
  .action(async (site: string, pagePath?: string) => {
    try {
      if (!pagePath) {
        const { xref } = await findSiteRoot(new URL(site));
        // shortcut: URLs only, no titles — myst.xref.json doesn't carry page
        // titles, and fetching every page to get one would hammer sites.
        for (const r of xref.references.filter((r: any) => r.kind === 'page')) {
          console.log(r.url);
        }
        return;
      }
      // Plain concatenation, not `new URL(pagePath, site)`: pagePath is an
      // absolute path (from myst.xref.json), and URL resolution would drop
      // any subpath a site is deployed under (e.g. site.com/guide).
      const p = pagePath.startsWith('/') ? pagePath : '/' + pagePath;
      const { page } = await resolvePage(site.replace(/\/$/, '') + p);
      for (const n of flattenBlocks(page.mdast)) {
        if (n.type === 'heading' && (n.html_id || n.identifier)) {
          // shortcut: crude first-text-value grab instead of a proper text
          // collector; replace if it garbles a real heading (e.g. inline math).
          const text = JSON.stringify(n).match(/"value":"([^"]*)"/)?.[1] ?? '';
          console.log(`${'  '.repeat((n.depth ?? 1) - 1)}${text} #${n.html_id ?? n.identifier}`);
        }
      }
    } catch (err) {
      fail(err);
    }
  });

// Fetch every page's JSON, a handful at a time so a large site doesn't open
// dozens of connections at once. A page that fails to fetch (e.g. a stale
// xref entry) is skipped rather than failing the whole search.
async function fetchAllPages(root: string, xref: any): Promise<{ url: string; mdast: any }[]> {
  const records = xref.references.filter((r: any) => r.kind === 'page');
  const CONCURRENCY = 8;
  const pages: { url: string; mdast: any }[] = [];
  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const batch = records.slice(i, i + CONCURRENCY);
    const fetched = await Promise.allSettled(
      batch.map((r: any) => fetchJson(r.data.startsWith('http') ? r.data : root + r.data)),
    );
    fetched.forEach((res, j) => {
      if (res.status === 'fulfilled') pages.push({ url: batch[j].url, mdast: res.value.mdast });
    });
  }
  return pages;
}

program
  .command('search <site> <query>')
  .description('search all pages of a site for a phrase')
  .action(async (site: string, query: string) => {
    try {
      const { root, xref } = await findSiteRoot(new URL(site));
      const pages = await fetchAllPages(root, xref);
      if (!pages.length && xref.references.some((r: any) => r.kind === 'page')) {
        console.error('warning: no pages could be fetched');
      }
      const hits = searchPages(pages, query);
      if (!hits.length) {
        console.error(`no matches for "${query}"`);
        process.exit(1);
      }
      for (const h of hits) {
        console.log(`${h.url}${h.anchor ? '#' + h.anchor : ''}\t${h.snippet}`);
      }
    } catch (err) {
      fail(err);
    }
  });

program
  .command('list <kind> <site>')
  .description('list figures | tables | headings | pages from the site index')
  .action(async (kind: string, site: string) => {
    try {
      const { xref } = await findSiteRoot(new URL(site));
      const singular = kind.replace(/s$/, '');
      const rows = xref.references.filter((r: any) => r.kind === singular);
      if (!rows.length) {
        console.error(`no ${kind} in site index`);
        process.exit(1);
      }
      // shortcut: identifier<TAB>url#anchor output, no captions — those would
      // require fetching every page; defer until someone needs them.
      for (const r of rows) {
        const anchor = r.html_id ?? r.identifier;
        console.log(`${r.identifier ?? '(no id)'}\t${r.url}${anchor ? '#' + anchor : ''}`);
      }
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
