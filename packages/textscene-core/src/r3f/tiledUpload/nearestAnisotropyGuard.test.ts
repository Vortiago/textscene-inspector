/**
 * Every file that sets a texture's Godot filter also reaches `useNearestAnisotropy`, directly or
 * through the tiled upload, since three leaves the anisotropy of filter 4 unwritten. A source scan,
 * because the next painter that samples a texture is the one to catch.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(import.meta.dirname, '../..');

/** The definers of the filter state, which hand it to a caller. */
const FILTER_DEFINERS = new Set([
  'r3f/canvasItemTextureSampler.ts',
  'resources/textures/godotTextureFilter.ts',
  'resources/textures/applyTextureState.ts',
]);

const SETS_FILTER = /\b(?:applyTextureFilterState|applyCanvasItemSampler|applyCanvasItemFilter)\(/;
const WRITES_ANISOTROPY = /\buseNearestAnisotropy\(|\buseUploadedClone\(|\buseTiledUpload\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    const isSource = /\.tsx?$/.test(entry.name) && !/\.(test|testkit)\.tsx?$/.test(entry.name);
    return isSource ? [full] : [];
  });
}

describe('files that set a texture filter', () => {
  const files = sourceFiles(SRC)
    .map((file) => ({
      file: path.relative(SRC, file).split(path.sep).join('/'),
      text: readFileSync(file, 'utf8'),
    }))
    .filter(({ file, text }) => !FILTER_DEFINERS.has(file) && SETS_FILTER.test(text));

  it('finds the filter sites, so the scan is not blind', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it('writes the anisotropy of filter 4 for every one', () => {
    expect(files.filter(({ text }) => !WRITES_ANISOTROPY.test(text)).map(({ file }) => file)).toEqual([]);
  });
});
