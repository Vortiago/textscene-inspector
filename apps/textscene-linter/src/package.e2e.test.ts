/**
 * Builds @textscene/linter once, then checks its bundles and installs the packed tarball into a
 * plain Node project, as a consumer does. The project has no bundler and no `@textscene/source`
 * condition, so a bundle that leans on either fails here, and a manifest without a guessable
 * entry point fails the bundle-size tools a consumer checks the package on.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isBuiltin } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { declaredExports } from '@textscene/dev-kit';
import { findForbiddenHostInputs } from '../../../scripts/check-bundle-size/hostBundles.mjs';
import { packTarball, run } from '../../../scripts/packTarball.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const distDir = join(packageDir, 'dist');
const bundlePath = join(distDir, 'index.js');
const metafilePath = join(distDir, 'build.meta.json');
const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

/** What a linting consumer needs: the run, the formatters and the `res://` root factory. */
const PUBLIC_VALUE_EXPORTS = [
  'collectFileDiagnostics',
  'createDiskResRoots',
  'escapeControlCharacters',
  'expandTscnPaths',
  'formatDiagnostics',
  'formatDim',
  'formatError',
  'formatFilePath',
  'formatGithubAnnotation',
  'formatGithubAnnotations',
  'formatJson',
  'formatSeverity',
  'formatSuccess',
  'getSeverityIcon',
  'lintFile',
  'lintFileDiagnostics',
  'printFileResult',
  'runLint',
  'toJsonFindings',
];
const PUBLIC_TYPE_EXPORTS = [
  'CollectDiagnosticsResult',
  'FileDiagnostics',
  'FileLintResult',
  'JsonFinding',
  'LintRunResult',
];

const CONSUMER_SCRIPT = `
import { collectFileDiagnostics, createDiskResRoots, expandTscnPaths, formatJson } from '@textscene/linter';
import { writeFileSync } from 'node:fs';

writeFileSync('clean.tscn', '[gd_scene format=3]\\n\\n[node name="Root" type="Node3D"]\\n');
const resRoots = createDiskResRoots(process.cwd());
const { exitCode, files } = await collectFileDiagnostics(expandTscnPaths(['clean.tscn']), resRoots);
console.log(JSON.stringify({ exitCode, findings: JSON.parse(formatJson(files)) }));
`;

const CONSUMER_TYPES = `
import {
  collectFileDiagnostics,
  createDiskResRoots,
  expandTscnPaths,
  type FileDiagnostics,
} from '@textscene/linter';

const resRoots = createDiskResRoots(null);

export async function lintScene(paths: string[]): Promise<FileDiagnostics[]> {
  const { files } = await collectFileDiagnostics(expandTscnPaths(paths), resRoots);
  return files;
}
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

type Metafile = {
  inputs: Record<string, unknown>;
  outputs: Record<string, { exports: string[]; imports: { path: string; external?: boolean }[] }>;
};

let metafile: Metafile;
let tarballDir: string;
let consumerDir: string;
let tarballEntries: string[];
let packedManifest: {
  bin: Record<string, string>;
  exports: Record<string, unknown>;
  main: string;
  types: string;
  version: string;
};

beforeAll(() => {
  run('pnpm', ['--filter', '@textscene/linter', 'build'], repoRoot);
  metafile = JSON.parse(readFileSync(metafilePath, 'utf8'));
  tarballDir = mkdtempSync(join(tmpdir(), 'linter-tarball-'));
  const tarballPath = packTarball(packageDir, tarballDir);
  tarballEntries = run('tar', ['-tzf', tarballPath], tarballDir).split('\n').filter(Boolean);
  packedManifest = JSON.parse(run('tar', ['-xzOf', tarballPath, 'package/package.json'], tarballDir));
  consumerDir = mkdtempSync(join(tmpdir(), 'linter-consumer-'));
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

describe('@textscene/linter library bundle', () => {
  it('exports exactly the public values', () => {
    expect([...metafile.outputs['dist/index.js']!.exports].sort()).toEqual(PUBLIC_VALUE_EXPORTS);
  });

  it('exports exactly the public types, beside the values', () => {
    expect(declaredExports(join(distDir, 'index.d.ts'))).toEqual(
      [...PUBLIC_VALUE_EXPORTS, ...PUBLIC_TYPE_EXPORTS].sort()
    );
  });

  it('holds no module of React, three.js or their ecosystem', () => {
    // A metafile of nothing passes the emptiness check, so the floor keeps the scan honest.
    expect(Object.keys(metafile.inputs).length).toBeGreaterThan(400);
    expect(findForbiddenHostInputs(metafile)).toEqual([]);
  });

  it('imports only Node builtins, so the library entry needs no dependency', () => {
    const external = metafile.outputs['dist/index.js']!.imports.filter(({ external }) => external);
    expect(external.length).toBeGreaterThan(0);
    for (const { path } of external) {
      expect(isBuiltin(path), path).toBe(true);
    }
  });

  it('imports to its end, starting no CLI', () => {
    // A CLI start would exit on its missing argument, so one import that reaches its
    // end proves the entry stays short of the CLI's `parseAsync`.
    expect(() =>
      execFileSync(
        process.execPath,
        ['--input-type=module', '--eval', `await import(${JSON.stringify(pathToFileURL(bundlePath).href)});`],
        { cwd: packageDir, timeout: 30_000 }
      )
    ).not.toThrow();
  });
});

describe('@textscene/linter tarball', () => {
  it('declares the entry point a bundler guesses, beside the bin', () => {
    expect(packedManifest).toMatchObject({
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
    });
    expect(Object.keys(packedManifest.bin)).toEqual(['tscn-lint']);
  });

  it('ships the library bundle, its declarations, the CLI and the bin', () => {
    expect(tarballEntries).toEqual(
      expect.arrayContaining([
        'package/dist/index.js',
        'package/dist/index.d.ts',
        'package/dist/cli.js',
        'package/bin/tscn-lint.js',
        'package/LICENSE',
        'package/README.md',
        'package/THIRD-PARTY-NOTICES.md',
      ])
    );
  });

  it('ships no metafile', () => {
    expect(tarballEntries.filter((entry) => entry.endsWith('.meta.json'))).toEqual([]);
  });

  it('ships the notices of the Godot code it holds, and of no other third party', () => {
    const notices = readFileSync(join(packageDir, 'THIRD-PARTY-NOTICES.md'), 'utf8');
    expect(notices).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(notices).toContain('packages/textscene-core/src/godot/math/color.ts');
    expect(notices).not.toContain('## FastNoiseLite');
    expect(notices).not.toContain('## Open Sans font');
  });

  it('runs the bin from the installed package for --version', () => {
    const bin = join(consumerDir, 'node_modules', '@textscene', 'linter', 'bin', 'tscn-lint.js');
    expect(run('node', [bin, '--version'], consumerDir).trim()).toBe(packedManifest.version);
  });
});

describe('@textscene/linter tarball in a plain Node project', () => {
  it('imports the package root and lints a clean scene', () => {
    expect(JSON.parse(run('node', ['use.mjs'], consumerDir))).toEqual({ exitCode: 0, findings: [] });
  });

  it('ships declarations that type-check without @textscene/core', () => {
    expect(() => run('node', [tscBin, '-p', '.'], consumerDir)).not.toThrow();
  });
});
