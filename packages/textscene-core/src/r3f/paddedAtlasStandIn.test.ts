import { renderHook } from '@testing-library/react';
import type * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { AtlasSourceModel } from '../resources/tileset/types';
import { canvasColorSpaceOf } from './canvasColorSpace';
import { publishLiveTargets } from './liveTargets';
import { createCanvasTarget } from './offscreen/targets';
import { usePaddedAtlasStandIn } from './paddedAtlasStandIn';
import { topDownTexture } from '../resources/textures/topDownTexture';
import { imageSize } from '../resources/formats/image/imagePixels';

const SOURCE: AtlasSourceModel = {
  texture: null,
  margins: { x: 0, y: 0 },
  separation: { x: 0, y: 0 },
  textureRegionSize: { x: 16, y: 16 },
  usesTexturePadding: true,
  tiles: new Map([['0:0', { sizeInAtlas: { x: 1, y: 1 }, alternatives: new Map() }]]),
};

/** Written by `unrenderedTarget`, each run after its test. */
const withdrawals: (() => void)[] = [];

afterEach(() => withdrawals.splice(0).forEach((withdraw) => withdraw()));

/** A SubViewport's target that its pass publishes and has not rendered yet. */
function unrenderedTarget() {
  const target = createCanvasTarget(32, 16, 'SubViewport', canvasColorSpaceOf(false));
  withdrawals.push(publishLiveTargets([target.texture], null, false));
  return { texture: target.texture as THREE.Texture };
}

describe('usePaddedAtlasStandIn', () => {
  it('gives every run of a source over an unrendered target one stand-in', () => {
    const slot = unrenderedTarget();

    const first = renderHook(() => usePaddedAtlasStandIn(slot, SOURCE));
    const second = renderHook(() => usePaddedAtlasStandIn(slot, SOURCE));

    expect(second.result.current).toBe(first.result.current);
  });

  it('pads a target resized before its first render at its new size', () => {
    const target = createCanvasTarget(32, 16, 'SubViewport', canvasColorSpaceOf(false));
    withdrawals.push(publishLiveTargets([target.texture], null, false));
    const slot = { texture: target.texture as THREE.Texture };
    const hook = renderHook(() => usePaddedAtlasStandIn(slot, SOURCE));

    target.setSize(64, 16);
    hook.rerender();

    expect(imageSize(hook.result.current!.image)).toEqual({ width: 72, height: 18 });
  });

  it('marks the stand-in top row first, so the shader path samples it with no turned copy', () => {
    const { result } = renderHook(() => usePaddedAtlasStandIn(unrenderedTarget(), SOURCE));

    expect(topDownTexture(result.current!)).toBe(result.current);
  });
});
