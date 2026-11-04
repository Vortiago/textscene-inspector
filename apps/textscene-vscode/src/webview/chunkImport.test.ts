/**
 * The webview's chunk importer. A browser keeps a failed module import failed for its URL, so
 * the second try loads the chunk at a new URL. A second failure rejects, for the pane's
 * error boundary.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLogAdapter } from '@textscene/core/logger';
import { CHUNK_IMPORTER, importChunk, setChunkFailureReporter } from './chunkImport';

/** Written by `emptyDirectory`. Removed after each test. */
const directories: string[] = [];

/** The URL, ending in a slash, of a new empty directory. */
function emptyDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'tsi-chunk-'));
  directories.push(directory);
  return pathToFileURL(directory).href + '/';
}

/** The URL, ending in a slash, of a directory that holds `chunk.mjs` with `source`. */
function chunkDirectory(source: string): string {
  const directory = emptyDirectory();
  writeFileSync(new URL('chunk.mjs', directory), source);
  return directory;
}

function captureWarnings(): string[] {
  const warnings: string[] = [];
  setLogAdapter({
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (message) => warnings.push(message),
    error: () => {},
  });
  return warnings;
}

describe('importChunk', () => {
  afterEach(() => {
    setLogAdapter(null);
    setChunkFailureReporter(() => {});
    vi.unstubAllGlobals();
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('resolves the chunk relative to the module that imports it', async () => {
    const base = chunkDirectory('export const answer = 42;') + 'webview.js';

    await expect(importChunk('./chunk.mjs', base)).resolves.toMatchObject({ answer: 42 });
  });

  it('warns nothing for a chunk that loads', async () => {
    const warnings = captureWarnings();

    await importChunk('./chunk.mjs', chunkDirectory('export {};') + 'webview.js');

    expect(warnings).toEqual([]);
  });

  it('imports a chunk that failed once again at a new URL, and rejects with that one', async () => {
    const failure = await importChunk('./missing.mjs', emptyDirectory() + 'webview.js').catch(String);

    expect(failure).toContain('missing.mjs?reload=1');
  });

  it('warns once, with the first URL and its error, for a chunk that fails', async () => {
    const warnings = captureWarnings();

    await importChunk('./missing.mjs', emptyDirectory() + 'webview.js').catch(() => {});

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(
      /^A preview chunk failed to load: file:.*\/missing\.mjs: .*\. It loads again\.$/
    );
  });

  it('installs itself as the global the rewritten chunk imports call', () => {
    expect((globalThis as Record<string, unknown>)[CHUNK_IMPORTER]).toBe(importChunk);
  });

  it('reports a chunk that fails at both URLs, since a new document is the one way left', async () => {
    const reported: string[] = [];
    setChunkFailureReporter((error) => reported.push(error));

    await importChunk('./missing.mjs', emptyDirectory() + 'webview.js').catch(() => {});

    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('missing.mjs?reload=1');
  });

  it('drops both copies of a chunk that fails at both URLs from the resource cache', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', {
      keys: async () => ['vscode-resource-cache-6'],
      open: async () => ({ delete: async (url: string) => deleted.push(url) }),
    });
    const base = emptyDirectory() + 'webview.js';

    await importChunk('./missing.mjs', base).catch(() => {});

    expect(deleted.map((url) => url.replace(base.replace('webview.js', ''), ''))).toEqual([
      'missing.mjs',
      'missing.mjs?reload=1',
    ]);
  });

  it('reports nothing for a chunk that loads', async () => {
    const reported: string[] = [];
    setChunkFailureReporter((error) => reported.push(error));

    await importChunk('./chunk.mjs', chunkDirectory('export {};') + 'webview.js');

    expect(reported).toEqual([]);
  });
});
