import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the cache at a fresh temp dir before anything else runs, so
// cacheClear()'s rmSync never touches the real ~/.cache/docslice.
process.env.DOCSLICE_CACHE_DIR = mkdtempSync(join(tmpdir(), 'docslice-test-'));

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { fetchJson, cacheClear, HttpError, NetworkError } from '../src/fetch.js';

let hits = 0;
const server = createServer((req, res) => {
  hits++;
  if (req.url === '/ok.json') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ hello: 'world' }));
  } else {
    res.statusCode = 404;
    res.end('nope');
  }
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as any).port;
const base = `http://127.0.0.1:${port}`;

describe('fetchJson', () => {
  afterAll(() => new Promise((r) => server.close(() => r(null))));
  beforeEach(() => {
    hits = 0;
    delete process.env.DOCSLICE_CACHE;
    cacheClear();
  });
  it('fetches JSON and caches within the TTL', async () => {
    expect(await fetchJson(`${base}/ok.json`)).toEqual({ hello: 'world' });
    expect(await fetchJson(`${base}/ok.json`)).toEqual({ hello: 'world' });
    expect(hits).toBe(1); // second call served from cache
  });
  it('bypasses the cache when DOCSLICE_CACHE=off', async () => {
    process.env.DOCSLICE_CACHE = 'off';
    await fetchJson(`${base}/ok.json`);
    await fetchJson(`${base}/ok.json`);
    expect(hits).toBe(2);
  });
  it('refetches when the cache entry is older than the TTL', async () => {
    await fetchJson(`${base}/ok.json`);
    await fetchJson(`${base}/ok.json`, 0);
    expect(hits).toBe(2);
  });
  it('throws HttpError with the status on non-2xx', async () => {
    await expect(fetchJson(`${base}/missing.json`)).rejects.toThrow(HttpError);
    await expect(fetchJson(`${base}/missing.json`)).rejects.toMatchObject({ status: 404 });
  });
  it('throws NetworkError when the connection fails', async () => {
    // Nothing listens on port 1; callers rely on this class (not the
    // runtime's TypeError) to tell network failures from HTTP errors.
    await expect(fetchJson('http://127.0.0.1:1/x.json')).rejects.toBeInstanceOf(NetworkError);
  });
});
