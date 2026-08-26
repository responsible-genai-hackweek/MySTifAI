// Usage: npm run recon -- <site-url> [--save tests/fixtures/<name>]
// Reports on a deployed MyST site's JSON endpoints; optionally saves fixtures.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [site, ...rest] = process.argv.slice(2);
const saveDir = rest[0] === '--save' ? rest[1] : undefined;
if (!site) {
  console.error('usage: recon <site-url> [--save <dir>]');
  process.exit(1);
}
const root = site.replace(/\/$/, '');

async function get(url: string): Promise<{ status: number; json?: any }> {
  const res = await fetch(url, { headers: { 'user-agent': 'myst-docs-recon' } });
  if (!res.ok) return { status: res.status };
  try {
    return { status: res.status, json: await res.json() };
  } catch {
    return { status: res.status }; // e.g. an HTML 200 fallback page — not JSON
  }
}

async function save(name: string, data: any) {
  if (!saveDir) return;
  await mkdir(saveDir, { recursive: true });
  await writeFile(join(saveDir, name), JSON.stringify(data, null, 1));
  console.error(`saved ${join(saveDir, name)}`);
}

// --- myst.xref.json ---
const xref = await get(`${root}/myst.xref.json`);
if (!xref.json) {
  console.log(`NOT A MYST SITE? myst.xref.json -> HTTP ${xref.status} (or non-JSON)`);
  process.exit(2);
}
const refs: any[] = xref.json.references ?? [];
const kinds: Record<string, number> = {};
for (const r of refs) kinds[r.kind ?? '?'] = (kinds[r.kind ?? '?'] ?? 0) + 1;
console.log(`myst.xref.json: version=${xref.json.version} myst=${xref.json.myst}`);
console.log(`  records: ${refs.length}, by kind: ${JSON.stringify(kinds)}`);
const sample = refs.find((r) => r.kind === 'page');
console.log(`  sample page record keys: ${sample ? Object.keys(sample).join(', ') : 'NONE'}`);
console.log(`  sample page record: ${JSON.stringify(sample)}`);
await save('myst.xref.json', xref.json);

// --- myst.search.json ---
const search = await get(`${root}/myst.search.json`);
if (search.json) {
  const recs: any[] = search.json.records ?? search.json;
  console.log(`myst.search.json: PRESENT, ${Array.isArray(recs) ? recs.length : '?'} records`);
  console.log(`  top-level keys: ${Object.keys(search.json).join(', ')}`);
  if (Array.isArray(recs) && recs[0])
    console.log(`  record[0] keys: ${Object.keys(recs[0]).join(', ')}`);
  await save('myst.search.json', search.json);
} else {
  console.log(`myst.search.json: ABSENT (HTTP ${search.status})`);
}

// --- page JSONs: first page, a nested (multi-segment URL) page, and any others ---
const pages = refs.filter((r) => r.kind === 'page' && r.data);
const nested = pages.find((r) => (r.url?.match(/\//g) ?? []).length > 1);
const picks = [...new Set([pages[0], nested, pages[Math.floor(pages.length / 2)]])].filter(Boolean);
for (const p of picks) {
  const dataUrl = p.data.startsWith('http') ? p.data : `${root}${p.data}`;
  const page = await get(dataUrl);
  if (!page.json) {
    console.log(`page ${p.url}: FAILED HTTP ${page.status} at ${dataUrl}`);
    continue;
  }
  const headings =
    JSON.stringify(page.json).match(/"type":"heading"/g)?.length ?? 0;
  console.log(`page ${p.url} (${dataUrl}):`);
  console.log(`  top-level keys: ${Object.keys(page.json).join(', ')}`);
  console.log(`  mdast root children types: ${[...new Set((page.json.mdast?.children ?? []).map((c: any) => c.type))].join(', ')}`);
  console.log(`  headings: ${headings}`);
  await save(`page${p.url.replace(/\//g, '.')}.json`, page.json);
}
