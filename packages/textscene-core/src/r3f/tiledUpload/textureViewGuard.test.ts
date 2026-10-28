/**
 * Every texture view a component draws comes from `useTextureView` or `useOwnedTextureView`, which
 * upload it in bands where large (ADR-0042) and free it once nothing draws it. three uploads each
 * clone with its own sampler settings separately, so a clone made by hand uploads whole, in one
 * call, however large, and nothing frees it. A source scan, because the next component that clones
 * a texture is the one to catch.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductionSource, offendingLines, repoPath, walkSources } from '../testing/sourceScan';

const SRC = path.resolve(import.meta.dirname, '../..');

/** The hook that makes views for a component. */
const VIEW_HOOK = 'packages/textscene-core/src/r3f/useTextureView.ts';

/** A texture clone, or a direct call to the view module. */
const BY_HAND = /\b(?:\w*[Tt]exture|decoded)\.clone\(\)|\b(?:textureView|ownedTextureView|releaseView)\(/;

describe('texture views a component draws', () => {
  const offending = walkSources([path.join(SRC, 'nodes'), path.join(SRC, 'r3f')], isProductionSource)
    .filter(({ source }) => offendingLines(source, BY_HAND).length > 0)
    .map(({ file }) => repoPath(file));

  it('finds the view hook, so the scan is not blind', () => {
    expect(offending).toContain(VIEW_HOOK);
  });

  it('leaves every view to the hook', () => {
    expect(offending.filter((file) => file !== VIEW_HOOK)).toEqual([]);
  });
});
