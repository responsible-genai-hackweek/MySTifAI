import { describe, it, expect, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { serveFixtures } from './serve-fixtures.js';

const run = promisify(execFile);
const guide = await serveFixtures('mystmd-guide');
// mystmd.org mounts several independent MyST sites under subpaths like
// /guide; use this to exercise a real "not a MyST site" (404s, not a
// connection failure) at a path outside the mounted site.
const mounted = await serveFixtures('mystmd-guide', '/guide');
afterAll(() => {
  guide.close();
  mounted.close();
});

// Run via tsx so no build step is needed; cache off so tests stay hermetic.
function cli(...args: string[]) {
  return run('npx', ['tsx', 'src/cli.ts', ...args], {
    env: { ...process.env, DOCSLICE_CACHE: 'off' },
  });
}

// Cold `npx tsx` subprocess spawns can brush vitest's 5s default on a cold
// CI runner.
const TIMEOUT = 15_000;

describe('docslice get', () => {
  it('prints a section as markdown', async () => {
    const { stdout } = await cli('get', `${guide.base}/interactive-notebooks#static-images`);
    expect(stdout).toContain('### Static images');
  }, TIMEOUT);
  it('prints raw mdast with --format json', async () => {
    const { stdout } = await cli('get', `${guide.base}/interactive-notebooks#static-images`, '--format', 'json');
    expect(JSON.parse(stdout).type).toBe('root');
  }, TIMEOUT);
  it('exits 1 on unknown anchor', async () => {
    await expect(cli('get', `${guide.base}/interactive-notebooks#nope`)).rejects.toMatchObject({ code: 1 });
  }, TIMEOUT);
  it('exits 3 on an unreachable host', async () => {
    await expect(cli('get', 'http://127.0.0.1:9/x')).rejects.toMatchObject({ code: 3 });
  }, TIMEOUT);
  it('exits 2 on a non-MyST site', async () => {
    await expect(cli('get', `${mounted.base}/x`)).rejects.toMatchObject({ code: 2 });
  }, TIMEOUT);
  it('finds a label anywhere on the site when given the site root', async () => {
    // img:mpl / #img-mpl lives on /interactive-notebooks, not the root page;
    // this only works via the site-wide xref lookup fallback.
    const { stdout } = await cli('get', `${guide.base}#img-mpl`);
    expect(stdout).toContain('img:mpl');
  }, TIMEOUT);
});

describe('docslice outline', () => {
  it('lists pages for a site with titles', async () => {
    const { stdout } = await cli('outline', guide.base);
    expect(stdout).toMatch(/\/interactive-notebooks\tGenerate and Display Rich Outputs/);
  }, TIMEOUT);
  it('lists headings with anchors for a page', async () => {
    const { stdout } = await cli('outline', guide.base, '/interactive-notebooks');
    expect(stdout).toContain('#static-images');
  }, TIMEOUT);
  it('accepts a full URL as the page argument', async () => {
    const { stdout } = await cli('outline', guide.base, `${guide.base}/interactive-notebooks`);
    expect(stdout).toContain('#static-images');
  }, TIMEOUT);
});

describe('docslice list', () => {
  it('lists figures with identifier and url#anchor', async () => {
    const { stdout } = await cli('list', 'figures', guide.base);
    expect(stdout).toMatch(/^img:mpl\t.+#img-mpl/m);
  }, TIMEOUT);
});
