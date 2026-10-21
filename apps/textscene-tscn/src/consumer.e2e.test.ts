/**
 * Installs the packed tarball into a plain Node project, as a consumer does, and uses it. The
 * project has no bundler and no `@textscene/source` condition, so a bundle that leans on either
 * fails here.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

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

describe('@textscene/tscn tarball in a plain Node project', () => {
  it('imports and parses a scene', () => {
    const output = run('node', ['use.mjs'], consumerDir);
    expect(JSON.parse(output)).toEqual({ root: 'Root', projectFile: 'project.godot' });
  });

  it('ships the licence and the third-party notices', () => {
    const installed = join(consumerDir, 'node_modules', '@textscene', 'tscn');
    expect(
      ['LICENSE', 'THIRD-PARTY-NOTICES.md'].filter((file) => !existsSync(join(installed, file)))
    ).toEqual([]);
  });

  it('ships declarations that type-check without @textscene/core', () => {
    expect(() => run('node', [tscBin, '-p', '.'], consumerDir)).not.toThrow();
  });
});
