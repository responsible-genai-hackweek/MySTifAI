/** All network access goes through this module; see docs/develop.md. */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, statSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DAY_MS = 24 * 60 * 60 * 1000;

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

/**
 * Where cached responses live. Reads MYST_DOCS_CACHE_DIR on every call
 * (rather than once at import time) so tests can point it at a temp
 * directory before calling fetchJson or cacheClear.
 */
function cacheRoot(): string {
  return process.env.MYST_DOCS_CACHE_DIR ?? join(homedir(), '.cache', 'myst-docs');
}

/**
 * Fetch a JSON endpoint, serving from the file cache when younger than ttlMs.
 * Set MYST_DOCS_CACHE=off to bypass the cache entirely (used by tests).
 */
export async function fetchJson(url: string, ttlMs = DAY_MS): Promise<any> {
  const off = process.env.MYST_DOCS_CACHE === 'off';
  // shortcut: flat per-URL cache files with mtime-based TTL; no ETag
  // revalidation. Add ETag support if stale-cache complaints ever show up.
  const file = join(
    cacheRoot(),
    createHash('sha256').update(url).digest('hex').slice(0, 16) + '.json',
  );
  if (!off) {
    try {
      // clamp to 0: mtimeMs can carry a fractional part ahead of Date.now()
      // (rounding), which would otherwise make a fresh file look negative-aged
      // and always pass a ttlMs of 0.
      const age = Math.max(0, Date.now() - statSync(file).mtimeMs);
      if (age < ttlMs) {
        return JSON.parse(readFileSync(file, 'utf8'));
      }
    } catch {} // no cache entry, or unreadable/corrupt one: fall through to a fresh fetch
  }
  const res = await fetch(url, { headers: { 'user-agent': 'myst-docs' } });
  if (!res.ok) throw new HttpError(res.status, url);
  const data = await res.json();
  if (!off) {
    mkdirSync(cacheRoot(), { recursive: true });
    writeFileSync(file, JSON.stringify(data));
  }
  return data;
}

export function cacheStatus(): { files: number; bytes: number; dir: string } {
  let files = 0;
  let bytes = 0;
  try {
    for (const f of readdirSync(cacheRoot())) {
      files++;
      bytes += statSync(join(cacheRoot(), f)).size;
    }
  } catch {} // cache dir doesn't exist yet
  return { files, bytes, dir: cacheRoot() };
}

export function cacheClear(): void {
  rmSync(cacheRoot(), { recursive: true, force: true });
}
