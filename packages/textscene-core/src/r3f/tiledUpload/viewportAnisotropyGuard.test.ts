import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductionSource, offendingLines, repoPath, walkSources } from '../testing/sourceScan';

const SRC = path.resolve(import.meta.dirname, '../..');

/** The definers of the filter state, which hand it to a caller. */
const FILTER_DEFINERS = new Set([
  'resources/textures/godotTextureFilter.ts',
  'resources/textures/textureView.ts',
]);

const SETS_FILTER = /\b(?:applyTextureFilterState|applyViewSampler)\(/;
const WRITES_ANISOTROPY = /\buseViewportAnisotropy\(|\buseTiledUpload\(/;

const isCode = (source: string, pattern: RegExp): boolean => offendingLines(source, pattern).length > 0;

// A source scan: each 3D draw writes the taps of its own viewport, so every filter site must hold one.
describe('files that set a texture filter', () => {
  const files = walkSources([SRC], isProductionSource).filter(
    ({ file, source }) =>
      !FILTER_DEFINERS.has(path.relative(SRC, file).split(path.sep).join('/')) && isCode(source, SETS_FILTER)
  );

  it('finds the filter sites, so the scan is not blind', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('writes the taps of its viewport for every one', () => {
    expect(
      files.filter(({ source }) => !isCode(source, WRITES_ANISOTROPY)).map(({ file }) => repoPath(file))
    ).toEqual([]);
  });
});
