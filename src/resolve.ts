/** Resolve a pasted MyST site URL to its page JSON; see docs/decisions.md. */

import { fetchJson } from './fetch.js';

const HOUR_MS = 60 * 60 * 1000;

export class NotMystSiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotMystSiteError';
  }
}

export class PageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageNotFoundError';
  }
}

/**
 * Find the MyST site root for a URL by probing for myst.xref.json,
 * deepest path first (handles sites deployed under subpaths, and multiple
 * independent sites on one domain — see docs/decisions.md).
 */
export async function findSiteRoot(url: URL): Promise<{ root: string; xref: any }> {
  const segments = url.pathname.split('/').filter(Boolean);
  for (let i = segments.length; i >= 0; i--) {
    const root = url.origin + (i ? '/' + segments.slice(0, i).join('/') : '');
    try {
      const xref = await fetchJson(`${root}/myst.xref.json`, HOUR_MS);
      if (Array.isArray(xref?.references)) return { root, xref };
    } catch {} // keep walking up
    // shortcut: failed probes aren't cached; revisit if deep paths feel slow.
  }
  throw new NotMystSiteError(
    `no myst.xref.json found at ${url.origin}${url.pathname} or any parent path — this may not be a MyST site`,
  );
}

/**
 * Resolve a pasted URL (with optional #fragment) to its page JSON and anchor.
 * The page's data URL comes from the xref record's `data` field, never derived
 * from the URL (derivation breaks on folder-index pages; docs/decisions.md).
 */
export async function resolvePage(rawUrl: string): Promise<{
  root: string;
  xref: any;
  page: any;
  anchor?: string;
}> {
  const url = new URL(rawUrl);
  const { root, xref } = await findSiteRoot(url);
  const rootPath = new URL(root).pathname.replace(/\/$/, '');
  const pagePath = url.pathname.slice(rootPath.length).replace(/\/$/, '') || '/';
  const rec = xref.references.find((r: any) => r.kind === 'page' && r.url === pagePath);
  if (!rec) throw new PageNotFoundError(`no page ${pagePath} in ${root}/myst.xref.json`);
  const page = await fetchJson(rec.data.startsWith('http') ? rec.data : root + rec.data);
  return { root, xref, page, anchor: decodeAnchor(url.hash) };
}

/** Browser-pasted fragments arrive percent-encoded (e.g. #sec-caf%C3%A9). */
function decodeAnchor(hash: string): string | undefined {
  if (!hash) return undefined;
  const raw = hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // malformed escape (e.g. a lone %); fall back to the raw hash
  }
}
