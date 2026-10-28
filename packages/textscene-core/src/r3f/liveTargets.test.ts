/**
 * A live target is shared by every reader, as Godot's ViewportTexture RID is, but each Godot reader
 * samples it with its own window, wrap and filter. A reader whose sampler differs from the target's
 * reads its own copy, which the target's pass refills after each render.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { liveTargetCrop, publishLiveTargets, unrenderedTexel } from './liveTargets';
import { ownedTextureView, releaseView, textureView } from '../resources/textures/textureView';
import { createCanvasTarget, createSceneTarget } from '../nodes/viewport/subviewport/offscreenViewport';
import { copiesFilledFrom } from './liveTargets.testkit';
import { holdUntilReleased } from './useDisposeOnRelease';

const FLIPPED = { repeat: { x: -1, y: 1 }, offset: { x: 1, y: 0 } };
const UPRIGHT = { repeat: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };

let withdrawals: (() => void)[] = [];
afterEach(() => {
  withdrawals.forEach((withdraw) => withdraw());
  withdrawals = [];
});

/** A canvas target its pass publishes, as a SubViewport does. */
function liveCanvasTarget(): THREE.WebGLRenderTarget {
  const target = createCanvasTarget(32, 16, 'SubViewport');
  withdrawals.push(publishLiveTargets([target.texture], null, false));
  return target;
}

describe('a reader of a live target', () => {
  it('reads its own copy when it samples through its own window', () => {
    const target = liveCanvasTarget();
    const view = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    expect(view).not.toBe(target.texture);
    expect(view.repeat.x).toBe(-1);
    expect(view.offset.x).toBe(1);
  });

  it("keeps the target's size and storage, so it samples the bytes the target holds", () => {
    const target = liveCanvasTarget();
    const view = ownedTextureView(target.texture, { colorSpace: THREE.NoColorSpace, window: FLIPPED });
    expect(view.image).toMatchObject({ width: 32, height: 16 });
    expect(view.internalFormat).toBe(target.texture.internalFormat);
    expect(view.colorSpace).toBe(target.texture.colorSpace);
  });

  it('reads its own copy for its own wrap and filter', () => {
    const target = liveCanvasTarget();
    const view = textureView(target.texture, {
      colorSpace: THREE.SRGBColorSpace,
      wrap: THREE.RepeatWrapping,
      filter: {
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
        generateMipmaps: false,
        anisotropy: 1,
      },
    });
    expect(view).not.toBe(target.texture);
    expect([view.wrapS, view.wrapT, view.magFilter]).toEqual([
      THREE.RepeatWrapping,
      THREE.RepeatWrapping,
      THREE.NearestFilter,
    ]);
  });

  it("shares the target when it samples the target's own state, whatever colour space it names", () => {
    const target = liveCanvasTarget();
    expect(textureView(target.texture, { colorSpace: THREE.NoColorSpace })).toBe(target.texture);
  });

  it("shares the target with a reader that owns its view but samples the target's own state", () => {
    const target = liveCanvasTarget();
    expect(ownedTextureView(target.texture, { colorSpace: THREE.NoColorSpace })).toBe(target.texture);
  });

  it('is refilled after each render of the target', () => {
    const target = liveCanvasTarget();
    const view = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    expect(copiesFilledFrom(target.texture)).toEqual([view]);
  });

  it('is no longer filled once released', () => {
    const target = liveCanvasTarget();
    const view = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    releaseView(view);
    expect(copiesFilledFrom(target.texture)).toEqual([]);
  });

  /** Godot's readers sample one RID, so readers that sample it alike need one copy between them. */
  it('shares one copy between readers that sample the target alike', () => {
    const target = liveCanvasTarget();
    const first = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    const second = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    expect(second).toBe(first);
    expect(copiesFilledFrom(target.texture)).toEqual([first]);
  });

  it('keeps a shared copy filled while another reader still holds it', () => {
    const target = liveCanvasTarget();
    const held = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    const release = holdUntilReleased(held);
    releaseView(ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED }));
    expect(copiesFilledFrom(target.texture)).toEqual([held]);
    release();
  });

  it("reads its own copy of another reader's copy, filled after that copy", () => {
    const target = liveCanvasTarget();
    const first = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    const second = ownedTextureView(first, { colorSpace: THREE.SRGBColorSpace, window: UPRIGHT });
    expect(copiesFilledFrom(target.texture)).toEqual([first, second]);
  });

  it('comes back as it is from a render target no pass publishes (edge case)', () => {
    const target = createSceneTarget(8, 8, 'Unpublished');
    expect(ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED })).toBe(
      target.texture
    );
  });
});

/** The 8 by 8 cell at a target's top-left corner. */
const CORNER_CELL = {
  width: 8,
  height: 8,
  source: { x: 0, y: 0, width: 8, height: 8 },
  dest: { x: 0, y: 0 },
};

describe('liveTargetCrop', () => {
  it('cuts a region out of the live target, at the region size plus its margin', () => {
    const target = liveCanvasTarget();
    const crop = liveTargetCrop(target.texture, {
      width: 12,
      height: 8,
      source: { x: 4, y: 2, width: 10, height: 6 },
      dest: { x: 1, y: 1 },
    });
    expect(crop.image).toMatchObject({ width: 12, height: 8 });
    expect(crop.internalFormat).toBe(target.texture.internalFormat);
  });

  it('is filled after the target it cuts, and a reader of the crop after the crop', () => {
    const target = liveCanvasTarget();
    const crop = liveTargetCrop(target.texture, CORNER_CELL);
    const reader = ownedTextureView(crop, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    expect(copiesFilledFrom(target.texture)).toEqual([crop, reader]);
  });
});

/** Godot reads an opaque target's image as RGB8 and a transparent one's as RGBA8 (`texture_storage.cpp:3571-3575`). */
describe('unrenderedTexel', () => {
  it('is opaque black for an opaque target', () => {
    expect(unrenderedTexel(liveCanvasTarget().texture)).toEqual([0, 0, 0, 255]);
  });

  it("is clear for a crop of a transparent target, which keeps its source's alpha", () => {
    const target = createCanvasTarget(32, 16, 'SubViewport');
    withdrawals.push(publishLiveTargets([target.texture], null, true));
    const crop = liveTargetCrop(target.texture, CORNER_CELL);
    expect(unrenderedTexel(crop)).toEqual([0, 0, 0, 0]);
    crop.dispose();
  });
});
