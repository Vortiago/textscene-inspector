/**
 * Every file that sets a texture's Godot filter itself also reaches `useNearestAnisotropy`, directly
 * or through the tiled upload, since three leaves the anisotropy of filter 4 unwritten. A texture
 * view reaches it through the tiled upload (`useTextureView.ts`). A source scan, because the next
 * painter that samples a texture is the one to catch.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductionSource, offendingLines, repoPath, walkSources } from '../testing/sourceScan';

const SRC = path.resolve(import.meta.dirname, '../..');

/** The definers of the filter state, which hand it to a caller. */
const FILTER_DEFINERS = new Set([
  'r3f/canvasItemTextureSampler.ts',
  'resources/textures/godotTextureFilter.ts',
  'resources/textures/textureView.ts',
]);

const SETS_FILTER = /\b(?:applyTextureFilterState|applyCanvasItemSampler)\(/;
const WRITES_ANISOTROPY = /\buseNearestAnisotropy\(|\buseTiledUpload\(/;

const isCode = (source: string, pattern: RegExp): boolean => offendingLines(source, pattern).length > 0;

describe('files that set a texture filter', () => {
  const files = walkSources([SRC], isProductionSource).filter(
    ({ file, source }) =>
      !FILTER_DEFINERS.has(path.relative(SRC, file).split(path.sep).join('/')) && isCode(source, SETS_FILTER)
  );

  it('finds the filter sites, so the scan is not blind', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('writes the anisotropy of filter 4 for every one', () => {
    expect(
      files.filter(({ source }) => !isCode(source, WRITES_ANISOTROPY)).map(({ file }) => repoPath(file))
    ).toEqual([]);
  });
});
