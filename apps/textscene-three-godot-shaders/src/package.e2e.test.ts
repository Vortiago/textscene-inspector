/**
 * Builds @textscene/three-godot-shaders once, then checks the bundle and installs the packed
 * tarball into a plain Node project beside three.js alone, as a consumer with no React does. The
 * project has no bundler and no `@textscene/source` condition, so a bundle that leans on either
 * fails here.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { declaredExports } from '@textscene/dev-kit';
import { installedVersion, packTarball, run, typeCheck } from '../../../scripts/packTarball.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const bundleKey = 'dist/index.js';

/** What a three.js app needs from the shader module. Core's internals stay out. */
const PUBLIC_VALUE_EXPORTS = ['installNodesHandler'];
const PUBLIC_TYPE_EXPORTS = ['NodeOutput'];

/** A renderer with no GL context: the install only hands it the handler. */
const CONSUMER_SCRIPT = `
import { installNodesHandler } from '@textscene/three-godot-shaders';
let handler = null;
installNodesHandler({ setNodesHandler: (given) => { handler = given; } });
console.log(JSON.stringify({ handler: handler?.constructor.name }));
`;

const CONSUMER_TYPES = `
import type { WebGLRenderer } from 'three';
import { installNodesHandler, type NodeOutput } from '@textscene/three-godot-shaders';
export function install(renderer: WebGLRenderer, output: NodeOutput): void {
  installNodesHandler(renderer, output);
}
`;

/** three.js alone at run time. Its types are for the type check, as a TypeScript consumer has them. */
const CONSUMER_MANIFEST = {
  name: 'consumer',
  type: 'module',
  dependencies: { three: installedVersion('three', 'apps/textscene-three-godot-shaders') },
  devDependencies: {
    '@types/three': installedVersion('@types/three', 'apps/textscene-three-godot-shaders'),
  },
};

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

type Metafile = {
  inputs: Record<string, unknown>;
  outputs: Record<string, { imports: { path: string }[] }>;
};

let metafile: Metafile;
let consumerDir: string;

beforeAll(() => {
  run('pnpm', ['--filter', '@textscene/three-godot-shaders', 'build'], repoRoot);
  metafile = JSON.parse(readFileSync(join(packageDir, 'dist', 'index.meta.json'), 'utf8'));
  const tarballDir = mkdtempSync(join(tmpdir(), 'shaders-tarball-'));
  const tarballPath = packTarball(packageDir, tarballDir);
  consumerDir = mkdtempSync(join(tmpdir(), 'shaders-consumer-'));
  writeFileSync(join(consumerDir, 'package.json'), JSON.stringify(CONSUMER_MANIFEST));
  run('npm', ['install', '--no-audit', '--no-fund', tarballPath], consumerDir);
  writeFileSync(join(consumerDir, 'use.mjs'), CONSUMER_SCRIPT);
  writeFileSync(join(consumerDir, 'types.mts'), CONSUMER_TYPES);
  writeFileSync(join(consumerDir, 'tsconfig.json'), JSON.stringify(CONSUMER_TSCONFIG));
  rmSync(tarballDir, { recursive: true });
}, 180_000);

afterAll(() => {
  if (consumerDir) rmSync(consumerDir, { recursive: true });
});

describe('@textscene/three-godot-shaders bundle', () => {
  it('exports exactly the public types, beside the values', () => {
    expect(declaredExports(join(packageDir, 'dist', 'index.d.ts'))).toEqual(
      [...PUBLIC_VALUE_EXPORTS, ...PUBLIC_TYPE_EXPORTS].sort()
    );
  });

  it('imports three.js and nothing else from the consumer', () => {
    const imports = metafile.outputs[bundleKey]!.imports.map(({ path }) => path);
    expect(imports.filter((path) => !/^three(\/|$)/.test(path))).toEqual([]);
  });

  it('holds no module of three.js, which the consumer supplies', () => {
    expect(Object.keys(metafile.inputs).filter((input) => input.includes('node_modules'))).toEqual([]);
  });
});

describe('@textscene/three-godot-shaders tarball beside three.js alone', () => {
  it('imports the entry and installs a nodes handler', () => {
    const output = run('node', ['use.mjs'], consumerDir);
    expect(JSON.parse(output)).toEqual({ handler: 'WebGLNodesHandler' });
  });

  it('exports exactly the public values', async () => {
    const output = run('node', ['--input-type=module', '-e', EXPORT_NAMES], consumerDir);
    expect(JSON.parse(output)).toEqual(PUBLIC_VALUE_EXPORTS);
  });

  it('ships the licence and the notices, and no metafile', () => {
    const installed = join(consumerDir, 'node_modules', '@textscene', 'three-godot-shaders');
    expect(existsSync(join(installed, 'LICENSE'))).toBe(true);
    expect(existsSync(join(installed, 'THIRD-PARTY-NOTICES.md'))).toBe(true);
    expect(existsSync(join(installed, 'dist', 'index.meta.json'))).toBe(false);
  });

  it('ships declarations that type-check without @textscene/core', () => {
    expect(() => typeCheck(consumerDir)).not.toThrow();
  });
});

/** The value names the installed entry exports, sorted. */
const EXPORT_NAMES = `
const entry = await import('@textscene/three-godot-shaders');
console.log(JSON.stringify(Object.keys(entry).sort()));
`;
