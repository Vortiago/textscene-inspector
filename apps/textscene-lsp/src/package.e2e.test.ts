/**
 * Builds @textscene/lsp once, then checks its bundles and installs the packed tarball into a
 * plain Node project, as a consumer does. The project has no bundler and no `@textscene/source`
 * condition, so a bundle that leans on either fails here, and a manifest without a guessable
 * entry point fails the bundle-size tools a consumer checks the package on.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findPackageJSON } from 'node:module';
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

/** What an LSP host needs: the translation from core's language features to the protocol shapes. */
const PUBLIC_VALUE_EXPORTS = [
  'toLspCodeAction',
  'toLspCompletion',
  'toLspDiagnostic',
  'toLspFoldingRange',
  'toLspHighlight',
  'toLspHover',
  'toLspSymbol',
];
const PUBLIC_TYPE_EXPORTS = [
  'CodeAction',
  'CompletionItem',
  'CompletionKind',
  'Diagnostic',
  'DocumentHighlight',
  'DocumentSymbol',
  'FoldingRange',
  'Hover',
  'Severity',
  'SymbolKind',
  'TextEdit',
];

const CONSUMER_SCRIPT = `
import { FoldingRangeKind } from 'vscode-languageserver/node';
import { toLspFoldingRange, toLspHover } from '@textscene/lsp';

const folding = toLspFoldingRange({ startLine: 2, endLine: 7 });
const hover = toLspHover({ markdown: 'A \`Node3D\` root.' });
console.log(JSON.stringify({ isRegion: folding.kind === FoldingRangeKind.Region, folding, hover }));
`;

const CONSUMER_TYPES = `
import { toLspCompletion, toLspDiagnostic, toLspSymbol, type CompletionItem, type Diagnostic, type DocumentSymbol } from '@textscene/lsp';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function completionOf(item: CompletionItem) {
  return toLspCompletion(item);
}

export function symbolOf(symbol: DocumentSymbol) {
  return toLspSymbol(symbol);
}

export function diagnosticOf(diagnostic: Diagnostic, document: TextDocument) {
  return toLspDiagnostic(diagnostic, document);
}
`;

/** The version of `name` that the workspace package at `base` tests against. */
function installedVersion(name: string, base: string): string {
  const manifestPath = findPackageJSON(name, join(repoRoot, base, 'package.json'));
  if (manifestPath === undefined) {
    throw new Error(`expected ${name} installed for ${base}, found none`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8')).version;
}

/** The translation names the vscode types, whose declarations read the Node builtins, so a strict
 * consumer installs @types/node, and it pins the versions the lsp app tests against. */
const CONSUMER_MANIFEST = {
  name: 'consumer',
  type: 'module',
  devDependencies: {
    '@types/node': `^${installedVersion('@types/node', 'apps/textscene-lsp')}`,
    'vscode-languageserver': `^${installedVersion('vscode-languageserver', 'apps/textscene-lsp')}`,
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
    types: ['node'],
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
};

beforeAll(() => {
  run('pnpm', ['--filter', '@textscene/lsp', 'build'], repoRoot);
  metafile = JSON.parse(readFileSync(metafilePath, 'utf8'));
  tarballDir = mkdtempSync(join(tmpdir(), 'lsp-tarball-'));
  const tarballPath = packTarball(packageDir, tarballDir);
  tarballEntries = run('tar', ['-tzf', tarballPath], tarballDir).split('\n').filter(Boolean);
  packedManifest = JSON.parse(run('tar', ['-xzOf', tarballPath, 'package/package.json'], tarballDir));
  consumerDir = mkdtempSync(join(tmpdir(), 'lsp-consumer-'));
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

describe('@textscene/lsp library bundle', () => {
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

  it('imports only its LSP dependencies, which the package installs', () => {
    const external = metafile.outputs['dist/index.js']!.imports.filter(({ external }) => external);
    expect(external.map(({ path }) => path).sort()).toEqual(['vscode-languageserver/node']);
  });

  it('imports to its end, starting no server', () => {
    // A server start reads its stdin, so one import that reaches its end proves the entry stays
    // short of the server's `createConnection`.
    expect(() =>
      execFileSync(
        process.execPath,
        ['--input-type=module', '--eval', `await import(${JSON.stringify(pathToFileURL(bundlePath).href)});`],
        { cwd: packageDir, timeout: 30_000 }
      )
    ).not.toThrow();
  });
});

describe('@textscene/lsp tarball', () => {
  it('declares the entry point a bundler guesses, beside the bin', () => {
    expect(packedManifest).toMatchObject({
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
    });
    expect(Object.keys(packedManifest.bin)).toEqual(['tscn-lsp']);
  });

  it('ships the library bundle, its declarations, the server and the bin', () => {
    expect(tarballEntries).toEqual(
      expect.arrayContaining([
        'package/dist/index.js',
        'package/dist/index.d.ts',
        'package/dist/server.js',
        'package/bin/tscn-lsp.js',
        'package/LICENSE',
        'package/README.md',
      ])
    );
  });

  it('ships no metafile', () => {
    expect(tarballEntries.filter((entry) => entry.endsWith('.meta.json'))).toEqual([]);
  });

  it('points the bin at the server bundle the tarball ships, with no version flag to run', () => {
    // The server reads stdio on import, so a spawn here would hang; server.e2e.test.ts drives
    // the identical bundle over the wire, and the bin only needs its relative import intact.
    const bin = join(consumerDir, 'node_modules', '@textscene', 'lsp', 'bin', 'tscn-lsp.js');
    expect(readFileSync(bin, 'utf8')).toContain(`import '../dist/server.js';`);
  });
});

describe('@textscene/lsp tarball in a plain Node project', () => {
  it('imports the package root and translates one folding range and one hover', () => {
    const output = JSON.parse(run('node', ['use.mjs'], consumerDir));
    expect(output.isRegion).toBe(true);
    expect(output.folding).toEqual({ startLine: 2, endLine: 7, kind: output.folding.kind });
    expect(output.hover).toEqual({ contents: { kind: 'markdown', value: 'A `Node3D` root.' } });
  });

  it('ships declarations that type-check without @textscene/core', () => {
    expect(() => run('node', [tscBin, '-p', '.'], consumerDir)).not.toThrow();
  });
});
