// Load the JSON captured from real MyST sites in tests/fixtures/ (see docs/recon-notes.md).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function loadFixture(site: string, name: string): any {
  return JSON.parse(readFileSync(join(FIXTURES, site, name), 'utf8'));
}

export function fixtureSites(): string[] {
  return readdirSync(FIXTURES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function fixturePages(site: string): string[] {
  return readdirSync(join(FIXTURES, site)).filter((f) => f.startsWith('page'));
}
