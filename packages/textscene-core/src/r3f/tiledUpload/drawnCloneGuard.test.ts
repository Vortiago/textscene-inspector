/**
 * Every texture clone a component draws reaches the tiled upload. three uploads each
 * clone with its own sampler settings separately, so a clone that bypasses
 * `useUploadedClone` uploads whole, in one call, however large (ADR-0042). A source
 * scan, because the next component that clones a texture is the one to catch.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(import.meta.dirname, '../..');

/** Pure helpers that make a clone for a caller to own; the guard checks their callers. */
const CLONE_HELPERS = new Set(['r3f/spriteFrame.ts', 'resources/textures/applyTextureState.ts']);

/** A texture clone: a `.clone()` on a texture-named value, or a call to a clone helper. */
const DRAWN_CLONE = /\b(?:\w*[Tt]exture|decoded)\.clone\(\)|\b(?:spriteSamplerClone|undecodedClone)\(/;
const ROUTED = /\buseUploadedClone\(|\buseTiledUpload\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    const isSource = /\.tsx?$/.test(entry.name) && !/\.(test|testkit)\.tsx?$/.test(entry.name);
    return isSource ? [full] : [];
  });
}

describe('drawn texture clones', () => {
  const files = [...sourceFiles(path.join(SRC, 'nodes')), ...sourceFiles(path.join(SRC, 'r3f'))]
    .map((file) => ({ file: path.relative(SRC, file).split(path.sep).join('/'), text: readFileSync(file, 'utf8') }))
    .filter(({ file, text }) => !CLONE_HELPERS.has(file) && DRAWN_CLONE.test(text));

  it('finds the clone sites, so the scan is not blind', () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
  });

  it('routes every drawn clone through the tiled upload', () => {
    expect(files.filter(({ text }) => !ROUTED.test(text)).map(({ file }) => file)).toEqual([]);
  });
});
