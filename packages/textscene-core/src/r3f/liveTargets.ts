/**
 * Live targets: render target textures a pass redraws, which every reader shares as Godot's readers
 * share a ViewportTexture RID. Each Godot reader samples that RID through its own sampler, so a
 * reader whose sampler differs from the target's reads a copy of its own, which the pass refills
 * after each render. A crop of a live target is a copy too, and every copy is live in its turn.
 */

import * as THREE from 'three';
import type { AtlasTextureLayout } from '../resources/textures/atlastexture/types';
import { copySampling } from '../resources/textures/copySampling';
import { imageSize, readRenderTargetPixels, type ImagePixels } from '../resources/formats/image/imagePixels';
import { perObject } from '../utils/perObject';
import { drawOffscreen } from './offscreen';
import { isHeld } from './useDisposeOnRelease';
import { holdsSrgbBytes, markSrgbBytes } from './srgbByteTextures';
import { copyTexels, wholeTexels, type TexelPlacement } from './texelCopy';

/** A copy that one live target fills. */
interface LiveCopy {
  readonly texture: THREE.Texture;
  /** The region a crop cuts, which readers that cut it alike share. Null for a copy of the whole target. */
  readonly cropKey: string | null;
  fill(gl: THREE.WebGLRenderer): void;
}

/**
 * A target's publishers, the copies it fills in the order they were made, the renderer that
 * holds its texels, null for one no renderer draws, and whether its image keeps alpha.
 */
interface LiveTarget {
  publishers: number;
  readonly copies: Set<LiveCopy>;
  renderer: THREE.WebGLRenderer | null;
  isTransparent: boolean;
}

/**
 * Written by `publishLiveTarget`, its withdrawal and `addCopy`. An entry goes with its texture, and a
 * copy leaves `copies` when it is disposed: by its last holder, or by its target's withdrawal when no
 * reader holds it.
 */
const liveTargetOf = perObject<THREE.Texture, LiveTarget>(() => ({
  publishers: 0,
  copies: new Set(),
  renderer: null,
  isTransparent: false,
}));

/**
 * Marks each of `textures` live while `renderer` redraws it, and answers one withdrawal for all. Two
 * publishers of one texture keep it live until both withdraw. `isTransparent` is the viewport's
 * `transparent_bg`.
 */
export function publishLiveTargets(
  textures: readonly THREE.Texture[],
  renderer: THREE.WebGLRenderer | null,
  isTransparent: boolean
): () => void {
  const withdrawals = textures.map((texture) => publishLiveTarget(texture, renderer, isTransparent));
  return () => withdrawals.forEach((withdraw) => withdraw());
}

function publishLiveTarget(
  texture: THREE.Texture,
  renderer: THREE.WebGLRenderer | null,
  isTransparent: boolean
): () => void {
  const live = liveTargetOf(texture);
  live.publishers++;
  setPublisher(texture, renderer, isTransparent);
  let isWithdrawn = false;
  return () => {
    if (isWithdrawn) return;
    isWithdrawn = true;
    live.publishers--;
    // A microtask, not now: a target that publishes again in one commit keeps the copies a reader
    // made in that render and holds only after it.
    queueMicrotask(() => freeUnheldCopies(live));
  };
}

/** Gives `texture` and every copy of it, at any depth, the renderer and transparency of its publisher. */
function setPublisher(
  texture: THREE.Texture,
  renderer: THREE.WebGLRenderer | null,
  isTransparent: boolean
): void {
  const live = liveTargetOf(texture);
  live.renderer = renderer;
  live.isTransparent = isTransparent;
  for (const copy of live.copies) setPublisher(copy.texture, renderer, isTransparent);
}

/** Frees the copies of a target no pass publishes any more, which no reader holds and none will. */
function freeUnheldCopies(live: LiveTarget): void {
  if (live.publishers > 0) return;
  for (const copy of [...live.copies]) {
    if (!isHeld(copy.texture)) copy.texture.dispose();
  }
}

/** Whether a pass redraws `texture`, so a reader that samples it differently needs its own copy. */
export function isLiveTarget(texture: THREE.Texture): boolean {
  return texture.isRenderTargetTexture === true && liveTargetOf(texture).publishers > 0;
}

/**
 * The texel Godot reads from the image of a live target no pass has rendered yet: zero, with no
 * alpha channel in an opaque target's image (`renderer_rd/storage_rd/texture_storage.cpp:3571-3575`).
 */
export function unrenderedTexel(texture: THREE.Texture): readonly [number, number, number, number] {
  return liveTargetOf(texture).isTransparent ? [0, 0, 0, 0] : [0, 0, 0, 255];
}

/**
 * The bytes Godot's image of a live target holds now, bottom row first, read back from its
 * renderer. Undefined for a texture no renderer publishes. A GPU readback, so only a rebuild that copies the target reads it.
 */
export function liveTargetPixels(texture: THREE.Texture): ImagePixels | undefined {
  const { renderer, publishers, isTransparent } = liveTargetOf(texture);
  if (!renderer || publishers === 0 || !texture.renderTarget) return undefined;
  const pixels = readRenderTargetPixels(renderer, texture.renderTarget as THREE.WebGLRenderTarget);
  if (!isTransparent) dropAlpha(pixels.data);
  return pixels;
}

/** An opaque target's image has no alpha channel (`renderer_rd/storage_rd/texture_storage.cpp:3571-3575`). */
function dropAlpha(data: Uint8Array | Uint8ClampedArray): void {
  for (let alpha = 3; alpha < data.length; alpha += 4) data[alpha] = 255;
}

/**
 * Refills every copy of `texture` that a reader holds, then the copies of each copy. The target's
 * pass calls it after each render. A copy no reader holds comes from a render React discarded, or
 * from a reader that has not committed yet and holds it before the next render.
 */
export function fillLiveTarget(texture: THREE.Texture, gl: THREE.WebGLRenderer): void {
  fillCopies(texture, gl, (copy) => isHeld(copy.texture));
}

/**
 * Fills every copy of `texture` now, held or not, for a reader that samples a copy before the
 * target's next render, as a sky bake does.
 */
export function fillEveryLiveCopy(texture: THREE.Texture, gl: THREE.WebGLRenderer): void {
  fillCopies(texture, gl, () => true);
}

function fillCopies(
  texture: THREE.Texture,
  gl: THREE.WebGLRenderer,
  isFilled: (copy: LiveCopy) => boolean
): void {
  const { copies } = liveTargetOf(texture);
  if (copies.size === 0) return;
  drawOffscreen(gl, () => {
    for (const copy of copies) {
      if (!isFilled(copy)) continue;
      copy.fill(gl);
      fillCopies(copy.texture, gl, isFilled);
    }
  });
}

/**
 * A copy of the whole of `source`, with its storage and sampler, which the caller samples through
 * its own sampler and frees with `dispose()`.
 */
export function liveTargetCopy(source: THREE.Texture): THREE.Texture {
  const { width, height } = targetSize(source);
  return addCopy(source, width, height, wholeTexels(width, height), null);
}

/** The whole copies of `source` that are not freed, in the order they were made. */
export function wholeLiveCopies(source: THREE.Texture): THREE.Texture[] {
  return [...liveTargetOf(source).copies].filter((copy) => copy.cropKey === null).map((copy) => copy.texture);
}

/**
 * The region `layout` cuts out of `source`, as Godot's AtlasTexture draws it: the region at its
 * margin offset inside the reported box, transparent elsewhere. Readers that cut one region share
 * one crop, as Godot's AtlasTextures draw from one RID. Each reader holds it, and the last to let go
 * frees it.
 */
export function liveTargetCrop(source: THREE.Texture, layout: AtlasTextureLayout): THREE.Texture {
  const placement = cropPlacement(targetSize(source).height, layout);
  const cropKey = JSON.stringify([layout.width, layout.height, placement]);
  const shared = [...liveTargetOf(source).copies].find((copy) => copy.cropKey === cropKey);
  return shared?.texture ?? addCopy(source, layout.width, layout.height, placement, cropKey);
}

/**
 * The placement that cuts `layout` out of a source `sourceHeight` texels high. A layout counts rows
 * from the top, as Godot's images do, and a render target from the bottom.
 */
function cropPlacement(sourceHeight: number, { height, source, dest }: AtlasTextureLayout): TexelPlacement {
  const destX = Math.round(dest.x);
  const destY = Math.round(dest.y);
  return {
    offsetX: source.x - destX,
    offsetY: sourceHeight - height - source.y + destY,
    rowStep: 1,
    bounds: [
      source.x,
      sourceHeight - source.y - source.height,
      source.x + source.width,
      sourceHeight - source.y,
    ],
  };
}

/**
 * A `width` x `height` copy of `source`'s storage that `source`'s pass fills through `placement`.
 * The copy keeps the source's format, tag and sRGB-byte mark, so it samples the bytes the source
 * holds the way the source would. It is live, so a reader of the copy is filled after it.
 */
function addCopy(
  source: THREE.Texture,
  width: number,
  height: number,
  placement: TexelPlacement,
  cropKey: string | null
): THREE.Texture {
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, type: source.type });
  const texture = copySampling(target.texture, source);
  texture.name = `${source.name}::copy`;
  texture.internalFormat = source.internalFormat;
  texture.colorSpace = source.colorSpace;
  if (holdsSrgbBytes(source)) markSrgbBytes(texture);

  const { copies, renderer, isTransparent } = liveTargetOf(source);
  const copy: LiveCopy = {
    texture,
    cropKey,
    fill: (gl) => copyTexels(gl, source, target, placement),
  };
  copies.add(copy);
  const withdraw = publishLiveTarget(texture, renderer, isTransparent);
  texture.addEventListener('dispose', () => {
    withdraw();
    copies.delete(copy);
    target.dispose();
  });
  return texture;
}

/** A render target's size, which its `image` always reports. */
function targetSize(texture: THREE.Texture): { width: number; height: number } {
  return imageSize(texture.image) ?? { width: 0, height: 0 };
}
