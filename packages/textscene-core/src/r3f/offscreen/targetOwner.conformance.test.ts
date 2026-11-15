/**
 * Every off-screen target of the 2D canvas is allocated in `r3f/offscreen/`, and freed through one
 * owner, `useDisposeOnRelease` and `holdUntilReleased`, which survive a StrictMode remount.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isProductionSource,
  offendingLines,
  reportOffenders,
  repoPath,
  walkSources,
} from '../testing/sourceScan';

const SRC = join(import.meta.dirname, '../..');

/** The 2D canvas paths. The 3D targets are the tonemap pass's (ADR-0061). */
const CANVAS_PATHS = [
  'r3f/canvasGroup',
  'r3f/lighting2d',
  'r3f/components/Canvas2DStage',
  'nodes/viewport',
  'nodes/2d',
].map((path) => join(SRC, path));

const ALLOCATES_TARGET = /\bnew THREE\.WebGL\w*RenderTarget\b/;
const DISPOSES = /\.dispose\(\)/;

/**
 * Owners whose own `dispose` frees what they hold. Each owner is held by `useDisposeOnRelease` or
 * `holdUntilReleased`, so the call runs only when the last holder lets go.
 */
const FREES_WHAT_IT_HOLDS: Record<string, string> = {
  'packages/textscene-core/src/r3f/lighting2d/lightAccumulationTargets.ts':
    'the set of accumulation targets of one signature, held by useDisposeOnRelease',
  'packages/textscene-core/src/nodes/viewport/subviewport/targetViews.ts':
    "a target's views and each view's copy target, held by useDisposeOnRelease and holdUntilReleased",
  'packages/textscene-core/src/nodes/viewport/subviewport/useBackdropTarget.ts':
    'the BG_CANVAS holder, held by useDisposeOnRelease, which also frees its target while no pass wants it',
};

const sources = walkSources(CANVAS_PATHS, isProductionSource);

describe('an off-screen target of the 2D canvas', () => {
  it('finds the canvas sources, so the scan cannot pass vacuously', () => {
    expect(sources.length).toBeGreaterThan(100);
    expect(sources.map(({ file }) => repoPath(file))).toEqual(
      expect.arrayContaining(Object.keys(FREES_WHAT_IT_HOLDS))
    );
  });

  it('is allocated only under r3f/offscreen/', () => {
    expect(reportOffenders(sources, (source) => offendingLines(source, ALLOCATES_TARGET))).toEqual([]);
  });

  it('is freed only through useDisposeOnRelease, or by an owner it holds', () => {
    const owned = sources.filter(({ file }) => !(repoPath(file) in FREES_WHAT_IT_HOLDS));
    expect(reportOffenders(owned, (source) => offendingLines(source, DISPOSES))).toEqual([]);
  });
});
