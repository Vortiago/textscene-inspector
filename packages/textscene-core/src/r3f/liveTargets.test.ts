/**
 * A live target is shared by every reader, as Godot's ViewportTexture RID is, but each Godot reader
 * samples it with its own window, wrap and filter. A reader whose sampler differs from the target's
 * reads its own copy, which the target's pass refills after each render.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fillEveryLiveCopy, liveTargetCrop, publishLiveTargets, unrenderedTexel } from './liveTargets';
import { ownedTextureView, releaseView, textureView } from '../resources/textures/textureView';
import { createCanvasTarget, createSceneTarget } from '../nodes/viewport/subviewport/offscreenViewport';
import { copiesFilledFrom, recordingRenderer } from './liveTargets.testkit';
import { holdUntilReleased } from './useDisposeOnRelease';
import { flippedUvWindow } from './uvWindow';

const FLIPPED = { repeat: { x: -1, y: 1 }, offset: { x: 1, y: 0 } };
const UPRIGHT = { repeat: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };

let withdrawals: (() => void)[] = [];
afterEach(() => {
  withdrawals.forEach((withdraw) => withdraw());
  withdrawals = [];
});

/** `view`, held as a reader that draws it holds it, until the test ends. */
function held(view: THREE.Texture): THREE.Texture {
  withdrawals.push(holdUntilReleased(view));
  return view;
}

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
    const view = held(
      ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED })
    );
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
    const first = held(
      ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED })
    );
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
    const first = held(
      ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED })
    );
    const second = held(ownedTextureView(first, { colorSpace: THREE.SRGBColorSpace, window: UPRIGHT }));
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

/** The 8 by 8 cell at x 8 of a 32 by 16 target's top row, as a sprite's frame window shows it. */
const SECOND_CELL_WINDOW = { repeat: { x: 0.25, y: 0.5 }, offset: { x: 0.25, y: 0.5 } };

/** The 8 by 4 cell at x 8, y 4 of a 32 by 16 target, a texel or more from every edge. */
const INNER_CELL_WINDOW = { repeat: { x: 0.25, y: 0.25 }, offset: { x: 0.25, y: 0.25 } };

/** A sprite steps its window over a target's cells, so a reader copies only the cell it shows. */
describe('a reader that windows a live target', () => {
  it('copies its cell with a texel of apron for the filter, not the whole target', () => {
    const target = liveCanvasTarget();
    const view = textureView(target.texture, {
      colorSpace: THREE.SRGBColorSpace,
      window: SECOND_CELL_WINDOW,
    });
    expect(view.image).toMatchObject({ width: 10, height: 9 });
  });

  it('samples the cell inside its apron', () => {
    const target = liveCanvasTarget();
    const view = textureView(target.texture, {
      colorSpace: THREE.SRGBColorSpace,
      window: SECOND_CELL_WINDOW,
    });
    expect([view.repeat.x, view.repeat.y]).toEqual([0.8, 8 / 9]);
    expect([view.offset.x, view.offset.y]).toEqual([0.1, 1 / 9]);
  });

  it('mirrors the cell by its sampler when its window flips', () => {
    const target = liveCanvasTarget();
    const flipped = flippedUvWindow(SECOND_CELL_WINDOW, true, false);
    const view = textureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: flipped });
    expect(view.image).toMatchObject({ width: 10, height: 9 });
    expect([view.repeat.x, view.offset.x]).toEqual([-0.8, 0.9]);
  });

  it('shares one copy with a reader that shows the same cell alike', () => {
    const target = liveCanvasTarget();
    const sampler = { colorSpace: THREE.SRGBColorSpace, window: SECOND_CELL_WINDOW };
    expect(textureView(target.texture, sampler)).toBe(held(textureView(target.texture, sampler)));
  });

  it("keeps apart from an AtlasTexture's crop of the same texels", () => {
    const target = liveCanvasTarget();
    const crop = held(
      liveTargetCrop(target.texture, {
        width: 10,
        height: 9,
        source: { x: 7, y: 0, width: 10, height: 9 },
        dest: { x: 0, y: 0 },
      })
    );
    expect(
      textureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: SECOND_CELL_WINDOW })
    ).not.toBe(crop);
  });

  it('copies the whole target when its cell touches an edge the sampler wraps over', () => {
    const target = liveCanvasTarget();
    const view = textureView(target.texture, {
      colorSpace: THREE.SRGBColorSpace,
      wrap: THREE.RepeatWrapping,
      window: SECOND_CELL_WINDOW,
    });
    expect(view.image).toMatchObject({ width: 32, height: 16 });
  });

  it('copies the whole target when its sampler reads a mip chain, which reads past any apron', () => {
    const target = liveCanvasTarget();
    target.texture.generateMipmaps = true;
    const view = textureView(target.texture, {
      colorSpace: THREE.SRGBColorSpace,
      window: INNER_CELL_WINDOW,
    });
    expect(view.image).toMatchObject({ width: 32, height: 16 });
  });

  it('copies the whole target when its window tiles past the target', () => {
    const target = liveCanvasTarget();
    const view = textureView(target.texture, {
      colorSpace: THREE.SRGBColorSpace,
      window: { repeat: { x: 2, y: 1 }, offset: { x: 0, y: 0 } },
    });
    expect(view.image).toMatchObject({ width: 32, height: 16 });
  });
});

/** A copy lives while a reader holds it. React can discard the render that made one. */
describe('a copy no reader holds', () => {
  it('is not refilled after a render of the target', () => {
    const target = liveCanvasTarget();
    ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    expect(copiesFilledFrom(target.texture)).toEqual([]);
  });

  it('is freed once its target is withdrawn', async () => {
    const target = createCanvasTarget(32, 16, 'SubViewport');
    const withdraw = publishLiveTargets([target.texture], null, false);
    const view = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    let isDisposed = false;
    view.addEventListener('dispose', () => (isDisposed = true));
    withdraw();
    await Promise.resolve();
    expect(isDisposed).toBe(true);
  });

  it('is filled on demand, for a reader that samples it before the next render', () => {
    const target = liveCanvasTarget();
    const view = ownedTextureView(target.texture, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED });
    const { gl, drawnInto } = recordingRenderer();
    fillEveryLiveCopy(target.texture, gl);
    expect(drawnInto.map((drawn) => drawn?.texture)).toEqual([view]);
  });
});

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
    const crop = held(liveTargetCrop(target.texture, CORNER_CELL));
    const reader = held(ownedTextureView(crop, { colorSpace: THREE.SRGBColorSpace, window: FLIPPED }));
    expect(copiesFilledFrom(target.texture)).toEqual([crop, reader]);
  });

  /** Godot's AtlasTextures draw from one RID, so two that cut one region need one crop. */
  it('shares one crop between readers that cut the same region', () => {
    const target = liveCanvasTarget();
    expect(liveTargetCrop(target.texture, { ...CORNER_CELL })).toBe(
      liveTargetCrop(target.texture, CORNER_CELL)
    );
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

  it('follows its target when the target publishes again with another transparency', () => {
    const target = createCanvasTarget(32, 16, 'SubViewport');
    const withdrawOpaque = publishLiveTargets([target.texture], null, false);
    const crop = liveTargetCrop(target.texture, CORNER_CELL);
    withdrawals.push(publishLiveTargets([target.texture], null, true));
    withdrawOpaque();
    expect(unrenderedTexel(crop)).toEqual([0, 0, 0, 0]);
    crop.dispose();
  });
});
