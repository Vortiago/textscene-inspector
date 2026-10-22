/**
 * Builds @textscene/renderer once, then checks its bundle and its packed tarball. The bundle must
 * leave React, three.js and their ecosystem to the consumer, so a consumer has one copy of each,
 * and it must need no resolver condition and no CSS-module support. The Vite consumer in
 * `scripts/renderer-consumer` renders the same tarball in a browser.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { declaredExports } from '@textscene/dev-kit';
import { findForbiddenHostInputs } from '../../../scripts/check-bundle-size/hostBundles.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const distDir = join(packageDir, 'dist');
const bundlePath = join(distDir, 'index.js');
const bundleKey = 'dist/index.js';

/** What a consumer needs to draw a parsed scene. Core's internals stay out. */
const PUBLIC_VALUE_EXPORTS = ['TscnCanvas', 'TscnSceneProvider', 'useSelection'];
const PUBLIC_TYPE_EXPORTS = ['ResourceProvider'];

/** The packages the bundle imports from the consumer, so it has one React and one three.js. */
const IMPORTED_PEERS = [
  '@react-three/drei',
  '@react-three/fiber',
  '@react-three/postprocessing',
  'postprocessing',
  'react',
  'three',
];

/** `react-dom` is a peer of `@react-three/fiber`, which the bundle imports and the consumer installs. */
const PEER_PACKAGES = [...IMPORTED_PEERS, 'react-dom'];

type Metafile = {
  inputs: Record<string, unknown>;
  outputs: Record<string, { exports: string[]; imports: { path: string; external?: boolean }[] }>;
};

let metafile: Metafile;
let tarballDir: string;
let tarballEntries: string[];
let packedManifest: { peerDependencies: Record<string, string>; dependencies: Record<string, string> };

const run = (command: string, args: string[], cwd: string) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

/** The package name of a bare specifier: `three/examples/jsm/x.js` is `three`, `@a/b/c` is `@a/b`. */
function packageOf(specifier: string): string {
  const [first = '', second = ''] = specifier.split('/');
  return first.startsWith('@') ? `${first}/${second}` : first;
}

const bareImports = () =>
  metafile.outputs[bundleKey]!.imports.map(({ path }) => path).filter((path) => !path.startsWith('.'));

beforeAll(() => {
  run('pnpm', ['--filter', '@textscene/renderer', 'build'], repoRoot);
  metafile = JSON.parse(readFileSync(join(distDir, 'index.meta.json'), 'utf8'));
  tarballDir = mkdtempSync(join(tmpdir(), 'renderer-tarball-'));
  run('pnpm', ['pack', '--pack-destination', tarballDir], packageDir);
  const [tarball] = readdirSync(tarballDir);
  const tarballPath = join(tarballDir, tarball!);
  tarballEntries = run('tar', ['-tzf', tarballPath], tarballDir).split('\n').filter(Boolean);
  packedManifest = JSON.parse(run('tar', ['-xzOf', tarballPath, 'package/package.json'], tarballDir));
}, 180_000);

afterAll(() => {
  if (tarballDir) rmSync(tarballDir, { recursive: true });
});

describe('@textscene/renderer bundle', () => {
  it('exports exactly the public values', () => {
    expect([...metafile.outputs[bundleKey]!.exports].sort()).toEqual(PUBLIC_VALUE_EXPORTS);
  });

  it('exports exactly the public types, beside the values', () => {
    expect(declaredExports(join(distDir, 'index.d.ts'))).toEqual(
      [...PUBLIC_VALUE_EXPORTS, ...PUBLIC_TYPE_EXPORTS].sort()
    );
  });

  it('holds no module of React, three.js or their ecosystem, which the consumer supplies', () => {
    expect(Object.keys(metafile.inputs).length).toBeGreaterThan(100);
    expect(findForbiddenHostInputs(metafile)).toEqual([]);
  });

  it.each(IMPORTED_PEERS)('imports %s from the consumer', (peer) => {
    expect(bareImports().map(packageOf)).toContain(peer);
  });

  it('imports only its peers and its dependencies', () => {
    const declared = [
      ...Object.keys(packedManifest.peerDependencies),
      ...Object.keys(packedManifest.dependencies),
    ];
    const undeclared = [...new Set(bareImports().map(packageOf))].filter((name) => !declared.includes(name));
    expect(undeclared).toEqual([]);
  });

  it('declares the peers the consumer must install', () => {
    expect(Object.keys(packedManifest.peerDependencies).sort()).toEqual([...PEER_PACKAGES].sort());
  });

  it('imports no workspace package and no stylesheet, so it needs no resolver condition', () => {
    const imports = bareImports();
    expect(imports.filter((path) => path.startsWith('@textscene/'))).toEqual([]);
    expect(imports.filter((path) => /\.css$/.test(path))).toEqual([]);
  });

  it('carries the canvas styles in the bundle, with no stylesheet beside it', () => {
    expect(Object.keys(metafile.inputs).some((input) => input.endsWith('TscnCanvas.module.css'))).toBe(true);
    expect(readdirSync(distDir).filter((name) => name.endsWith('.css'))).toEqual([]);
    expect(readFileSync(bundlePath, 'utf8')).toContain('touch-action');
  });
});

describe('@textscene/renderer tarball', () => {
  it('ships the bundle, the declarations, the licence and the notices', () => {
    expect(tarballEntries).toEqual(
      expect.arrayContaining([
        'package/dist/index.js',
        'package/dist/index.d.ts',
        'package/LICENSE',
        'package/README.md',
        'package/THIRD-PARTY-NOTICES.md',
      ])
    );
  });

  it('ships no metafile', () => {
    expect(tarballEntries.filter((entry) => entry.endsWith('.meta.json'))).toEqual([]);
  });

  it('resolves the workspace and catalog specifiers of its dependencies and peers', () => {
    const specifiers = [
      ...Object.values(packedManifest.peerDependencies),
      ...Object.values(packedManifest.dependencies),
    ];
    expect(specifiers.filter((range) => /^(catalog|workspace):/.test(range))).toEqual([]);
  });

  it('ships the notices of the third-party code it holds, and of no other', () => {
    const notices = readFileSync(join(packageDir, 'THIRD-PARTY-NOTICES.md'), 'utf8');
    expect(notices).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(notices).toContain('packages/textscene-core/src/godot/math/color.ts');
    expect(notices).toContain('## FastNoiseLite');
    expect(notices).toContain('## Open Sans font');
    expect(notices).not.toContain('## Godot demo projects');
  });
});
