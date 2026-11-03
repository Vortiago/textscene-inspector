/**
 * The esbuild plugin that routes the webview's chunk imports through the chunk importer, so a
 * chunk VS Code cut short loads once more.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';
import { CHUNK_IMPORTER } from '../webview/chunkImport';
import {
  chunkImportPlugin,
  CHUNK_IMPORTER as PLUGIN_CHUNK_IMPORTER,
  rewriteChunkImports,
} from './chunkImportPlugin.mjs';

describe('rewriteChunkImports', () => {
  it('routes an import of a listed chunk through the importer, relative to the importing module', () => {
    expect(rewriteChunkImports('import("./chunks/a-1.js").then(f)', ['./chunks/a-1.js'])).toBe(
      `${CHUNK_IMPORTER}("./chunks/a-1.js",import.meta.url).then(f)`
    );
  });

  it('fails the build for a listed chunk it finds no import of, so the retry never goes missing', () => {
    expect(() => rewriteChunkImports('import( "./chunks/a-1.js")', ['./chunks/a-1.js'])).toThrow(
      'expected import("./chunks/a-1.js") in the output, found none'
    );
  });

  it('leaves an import of anything but a listed chunk as it is', () => {
    const others = 'import("./other.js");import(url)';

    expect(rewriteChunkImports(`${others};import("./chunks/a-1.js")`, ['./chunks/a-1.js'])).toBe(
      `${others};${CHUNK_IMPORTER}("./chunks/a-1.js",import.meta.url)`
    );
  });
});

describe('chunkImportPlugin', () => {
  it('names the same global the webview installs', () => {
    expect(PLUGIN_CHUNK_IMPORTER).toBe(CHUNK_IMPORTER);
  });

  it('rewrites the dynamic imports a split build writes', async () => {
    const source = mkdtempSync(join(tmpdir(), 'tsi-split-'));
    writeFileSync(join(source, 'entry.js'), 'export const load = () => import("./lazy.js");');
    writeFileSync(join(source, 'lazy.js'), 'export const lazy = 1;');
    const outdir = join(source, 'out');

    try {
      await buildSplit(source, outdir);
      const entry = readFileSync(join(outdir, 'entry.js'), 'utf8');
      expect(entry).toMatch(
        new RegExp(`${CHUNK_IMPORTER}\\("\\./chunks/lazy-\\w+\\.js", ?import\\.meta\\.url\\)`)
      );
      expect(entry).not.toMatch(/import\("/);
    } finally {
      rmSync(source, { recursive: true, force: true });
    }
  });
});

/** A code-split build of `entry.js` in `source`, through the plugin. */
async function buildSplit(source: string, outdir: string): Promise<void> {
  await esbuild.build({
    absWorkingDir: source,
    entryPoints: ['entry.js'],
    bundle: true,
    format: 'esm',
    splitting: true,
    outdir,
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    logLevel: 'silent',
    plugins: [chunkImportPlugin()],
  });
}
