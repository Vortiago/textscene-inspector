/** The public-edition leak check, over synthetic dist listings and one real directory read. */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findPublicSiteLeaks, readDist } from './check-public-site.mjs';

const SCENES = ['unit-plane-mesh.tscn', 'demos/2d/platformer/player.tscn'];

const CLEAN_INDEX = '<script type="module" src="./assets/index-1.js"></script>';

const scratch = [];

afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

describe('findPublicSiteLeaks', () => {
  it('passes a public-edition build', () => {
    const files = [
      { path: 'index.html', text: CLEAN_INDEX },
      { path: 'assets/index-1.js', text: 'const fixtures = [];' },
      { path: 'assets/index-1.css', text: 'body{}' },
      { path: 'assets/font.woff2' },
    ];

    expect(findPublicSiteLeaks(files, SCENES)).toEqual([]);
  });

  it('flags a fixtures mirror and a parity gallery', () => {
    const files = [{ path: 'fixtures/unit-plane-mesh.tscn' }, { path: 'parity/index.html', text: '' }];

    expect(findPublicSiteLeaks(files, SCENES)).toEqual([
      'fixtures/unit-plane-mesh.tscn: a dev-only fixtures/ file',
      'parity/index.html: a dev-only parity/ file',
    ]);
  });

  it('flags a source map', () => {
    expect(findPublicSiteLeaks([{ path: 'assets/index-1.js.map' }], SCENES)).toEqual([
      'assets/index-1.js.map: a source map',
    ]);
  });

  it('flags a bundle that names a built-in scene', () => {
    const files = [{ path: 'assets/index-1.js', text: 'find(e=>e.file==="unit-plane-mesh.tscn")' }];

    expect(findPublicSiteLeaks(files, SCENES)).toEqual([
      'assets/index-1.js: names the built-in scene unit-plane-mesh.tscn',
    ]);
  });

  it('flags a root-absolute URL in the HTML', () => {
    const files = [{ path: 'index.html', text: '<link href="/assets/index-1.css">' }];

    expect(findPublicSiteLeaks(files, SCENES)).toEqual([
      'index.html: root-absolute href="/assets/index-1.css"',
    ]);
  });

  it('passes a protocol-relative URL and a data URL', () => {
    const files = [
      { path: 'index.html', text: '<link href="//fonts.example/a.css"><link href="data:x">' },
    ];

    expect(findPublicSiteLeaks(files, SCENES)).toEqual([]);
  });

  it('passes an empty dist', () => {
    expect(findPublicSiteLeaks([], SCENES)).toEqual([]);
  });
});

describe('readDist', () => {
  it('lists nested files with posix paths and reads only the text files', () => {
    const dist = mkdtempSync(join(tmpdir(), 'public-site-'));
    scratch.push(dist);
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), CLEAN_INDEX);
    writeFileSync(join(dist, 'assets', 'font.woff2'), 'binary');

    const files = readDist(dist).sort((a, b) => a.path.localeCompare(b.path));

    expect(files).toEqual([
      { path: 'assets/font.woff2' },
      { path: 'index.html', text: CLEAN_INDEX },
    ]);
  });
});
