// Serves one fixture site (xref + saved pages) over local HTTP, so resolve
// and CLI tests can exercise real HTTP requests against fixture data offline.
import { createServer, type Server } from 'node:http';
import { loadFixture, fixturePages } from './helpers.js';

/**
 * Serve a fixture site (xref + its saved pages) on an ephemeral port.
 * Pass `prefix` (e.g. '/guide') to mount the site under a subpath, matching
 * how real deployments like mystmd.org host several independent sites.
 */
export async function serveFixtures(
  site: string,
  prefix = '',
): Promise<{ base: string; close: () => void }> {
  const xref = loadFixture(site, 'myst.xref.json');
  const bodies = new Map<string, any>([[`${prefix}/myst.xref.json`, xref]]);
  for (const f of fixturePages(site)) {
    // fixture files are named page<url-with-slashes-as-dots>.json
    const url = f.slice('page'.length, -'.json'.length).replace(/\./g, '/') || '/';
    const rec = xref.references.find((r: any) => r.kind === 'page' && r.url === url);
    if (!rec) throw new Error(`fixture file ${site}/${f} matches no page record in its xref`);
    bodies.set(prefix + rec.data, loadFixture(site, f));
  }
  const server: Server = createServer((req, res) => {
    const body = bodies.get(req.url ?? '');
    if (!body) {
      res.statusCode = 404;
      return res.end('not found');
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() };
}
