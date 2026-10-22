/**
 * Builds @textscene/tscn once, then checks the bundle and installs the packed tarball into a plain
 * Node project, as a consumer does. The project has no bundler and no `@textscene/source`
 * condition, so a bundle that leans on either fails here.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { declaredExports } from '@textscene/dev-kit';
import { findForbiddenHostInputs } from '../../../scripts/check-bundle-size/hostBundles.mjs';
import { packTarball } from '../../../scripts/packTarball.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const bundlePath = join(packageDir, 'dist', 'index.js');
const metafilePath = join(packageDir, 'dist', 'index.meta.json');
const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

/** What a parser user needs: the parser and the shapes of the scene it returns. Core's internals stay out. */
const PUBLIC_VALUE_EXPORTS = ['TscnParser'];
const PUBLIC_TYPE_EXPORTS = [
  'RawNode',
  'TscnExternalResource',
  'TscnInternalResource',
  'TscnMainResource',
  'TscnNode',
  'TscnScene',
];

const CONSUMER_SCRIPT = `
import { TscnParser } from '@textscene/tscn';
const scene = new TscnParser().parse('[gd_scene format=3]\\n\\n[node name="Root" type="Node3D"]\\n');
console.log(JSON.stringify({ root: scene.nodes[0].name }));
`;

const CONSUMER_TYPES = `
import { TscnParser, type TscnNode, type TscnScene } from '@textscene/tscn';
const scene: TscnScene = new TscnParser().parse('');
export const roots: TscnNode[] = scene.nodes;
`;

const CONSUMER_TSCONFIG = {
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    target: 'ES2022',
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    types: [],
  },
  files: ['types.mts'],
};

let consumerDir: string;

const run = (command: string, args: string[], cwd: string) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

beforeAll(() => {
  run('pnpm', ['--filter', '@textscene/tscn', 'build'], repoRoot);
  const tarballDir = mkdtempSync(join(tmpdir(), 'tscn-tarball-'));
  const tarballPath = packTarball(packageDir, tarballDir);
  consumerDir = mkdtempSync(join(tmpdir(), 'tscn-consumer-'));
  writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module' }));
  run('npm', ['install', '--no-audit', '--no-fund', tarballPath], consumerDir);
  writeFileSync(join(consumerDir, 'use.mjs'), CONSUMER_SCRIPT);
  writeFileSync(join(consumerDir, 'types.mts'), CONSUMER_TYPES);
  writeFileSync(join(consumerDir, 'tsconfig.json'), JSON.stringify(CONSUMER_TSCONFIG));
  rmSync(tarballDir, { recursive: true });
}, 180_000);

afterAll(() => {
  if (consumerDir) rmSync(consumerDir, { recursive: true });
});

describe('@textscene/tscn bundle', () => {
  it('exports exactly the public values', async () => {
    const exported = await import(pathToFileURL(bundlePath).href);
    expect(Object.keys(exported).sort()).toEqual(PUBLIC_VALUE_EXPORTS);
  });

  it('exports exactly the public types, beside the values', () => {
    expect(declaredExports(join(packageDir, 'dist', 'index.d.ts'))).toEqual(
      [...PUBLIC_VALUE_EXPORTS, ...PUBLIC_TYPE_EXPORTS].sort()
    );
  });

  it('imports nothing, so it needs no dependency and no resolver condition', () => {
    expect(readFileSync(bundlePath, 'utf8')).not.toMatch(/^\s*(import|export)\b[^;]*\sfrom\s*['"]/m);
  });

  it('holds no React and no three.js module', () => {
    const metafile = JSON.parse(readFileSync(metafilePath, 'utf8'));
    expect(Object.keys(metafile.inputs).length).toBeGreaterThan(100);
    expect(findForbiddenHostInputs(metafile)).toEqual([]);
  });
});

describe('@textscene/tscn tarball in a plain Node project', () => {
  it('imports and parses a scene', () => {
    const output = run('node', ['use.mjs'], consumerDir);
    expect(JSON.parse(output)).toEqual({ root: 'Root' });
  });

  it('ships the licence, and no metafile', () => {
    const installed = join(consumerDir, 'node_modules', '@textscene', 'tscn');
    expect(existsSync(join(installed, 'LICENSE'))).toBe(true);
    expect(existsSync(join(installed, 'dist', 'index.meta.json'))).toBe(false);
  });

  it('ships the notices of the Godot code it holds, and of no other third party', () => {
    const installed = join(consumerDir, 'node_modules', '@textscene', 'tscn');
    const notices = readFileSync(join(installed, 'THIRD-PARTY-NOTICES.md'), 'utf8');
    expect(notices).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(notices).toContain('packages/textscene-core/src/godot/math/color.ts');
    expect(notices).not.toContain('## Open Sans font');
  });

  it('ships declarations that type-check without @textscene/core', () => {
    expect(() => run('node', [tscBin, '-p', '.'], consumerDir)).not.toThrow();
  });
});
