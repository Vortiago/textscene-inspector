/**
 * The webview's chunk importer. A browser keeps a failed module import failed for its URL, so
 * the second try loads the chunk at a new URL. A second failure rejects, for the pane's
 * error boundary.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { setLogAdapter } from '@textscene/core/logger';
import { CHUNK_IMPORTER, importChunk } from './chunkImport';

/** A directory URL, ending in a slash, that holds `chunk.mjs` with `source`. */
function chunkDirectory(source: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'tsi-chunk-'));
  writeFileSync(join(directory, 'chunk.mjs'), source);
  return pathToFileURL(directory).href + '/';
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
  afterEach(() => setLogAdapter(null));

  it('resolves the chunk relative to the module that imports it', async () => {
    const base = chunkDirectory('export const answer = 42;') + 'webview.js';

    await expect(importChunk('./chunk.mjs', base)).resolves.toMatchObject({ answer: 42 });
  });

  it('warns nothing for a chunk that loads', async () => {
    const warnings = captureWarnings();

    await importChunk('./chunk.mjs', chunkDirectory('export {};') + 'webview.js');

    expect(warnings).toEqual([]);
  });

  it('loads a chunk that failed once again at a new URL, and warns once', async () => {
    const warnings = captureWarnings();
    const base = chunkDirectory('export {};') + 'webview.js';

    const failure = await importChunk('./missing.mjs', base).catch((error: unknown) => String(error));

    expect(failure).toContain('missing.mjs?reload=1');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(
      /^A preview chunk failed to load: file:.*\/missing\.mjs: .*\. It loads again\.$/
    );
  });

  it('installs itself as the global the rewritten chunk imports call', () => {
    expect((globalThis as Record<string, unknown>)[CHUNK_IMPORTER]).toBe(importChunk);
  });
});
