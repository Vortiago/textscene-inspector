/**
 * Builds @textscene/tscn once, then checks the bundle and installs the packed tarball into a plain
 * Node project, as a consumer does. The project has no bundler and no `@textscene/source`
 * condition, so a bundle that leans on either fails here.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findForbiddenHostInputs } from '../../../scripts/check-bundle-size/hostBundles.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const bundlePath = join(packageDir, 'dist', 'index.js');
const metafilePath = join(packageDir, 'dist', 'index.meta.json');
const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

/** The runtime exports of core's `./parser` and `./godot` entries. A new export is a decision to publish it. */
const PUBLIC_VALUE_EXPORTS = [
  'PROJECT_FILE_NAME',
  'PROJECT_FILE_PATH',
  'SCAN_STOP_FILES',
  'TscnParser',
  'importSidecarPath',
  'isGodotTextResourcePath',
  'isScannedPath',
];

const CONSUMER_SCRIPT = `
import { TscnParser, PROJECT_FILE_NAME } from '@textscene/tscn';
const scene = new TscnParser().parse('[gd_scene format=3]\\n\\n[node name="Root" type="Node3D"]\\n');
console.log(JSON.stringify({ root: scene.nodes[0].name, projectFile: PROJECT_FILE_NAME }));
`;

const CONSUMER_TYPES = `
import { TscnParser, type TscnScene } from '@textscene/tscn';
const scene: TscnScene = new TscnParser().parse('');
export const nodeCount: number = scene.nodes.length;
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
  run('pnpm', ['pack', '--pack-destination', tarballDir], packageDir);
  const [tarball] = readdirSync(tarballDir);
  consumerDir = mkdtempSync(join(tmpdir(), 'tscn-consumer-'));
  writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module' }));
  run('npm', ['install', '--no-audit', '--no-fund', join(tarballDir, tarball!)], consumerDir);
  writeFileSync(join(consumerDir, 'use.mjs'), CONSUMER_SCRIPT);
  writeFileSync(join(consumerDir, 'types.mts'), CONSUMER_TYPES);
  writeFileSync(join(consumerDir, 'tsconfig.json'), JSON.stringify(CONSUMER_TSCONFIG));
  rmSync(tarballDir, { recursive: true });
}, 180_000);

afterAll(() => {
  if (consumerDir) rmSync(consumerDir, { recursive: true });
});

describe('@textscene/tscn bundle', () => {
  it('exports exactly the parser and engine-fact entries of core', async () => {
    const exported = await import(pathToFileURL(bundlePath).href);
    expect(Object.keys(exported).sort()).toEqual(PUBLIC_VALUE_EXPORTS);
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
    expect(JSON.parse(output)).toEqual({ root: 'Root', projectFile: 'project.godot' });
  });

  it('ships the licence and the third-party notices, and no metafile', () => {
    const installed = join(consumerDir, 'node_modules', '@textscene', 'tscn');
    expect(
      ['LICENSE', 'THIRD-PARTY-NOTICES.md'].filter((file) => !existsSync(join(installed, file)))
    ).toEqual([]);
    expect(existsSync(join(installed, 'dist', 'index.meta.json'))).toBe(false);
  });

  it('ships declarations that type-check without @textscene/core', () => {
    expect(() => run('node', [tscBin, '-p', '.'], consumerDir)).not.toThrow();
  });
});
