import { useContext, useEffect } from 'react';
import type * as THREE from 'three';
import { context } from '@react-three/fiber';
import { handleOf } from './sharedTexture';

/**
 * The taps the 3D draw under way samples an anisotropic texture with, or null in a canvas draw and
 * outside every draw, where Godot's default samplers hold (`renderer_canvas_render_rd.cpp:460`).
 * Written only by `drawAtAnisotropicLevel`.
 */
let levelUnderWay: number | null = null;

/** Each drawn texture's renderer and its holds. The last release deletes the entry. */
const drawnTextures = new Map<THREE.Texture, { renderer: THREE.WebGLRenderer; holds: number }>();

/** The taps last written to a texture's GPU storage, so a pass at the same level writes nothing. */
// eslint-disable-next-line no-restricted-syntax -- a record each write replaces, not a value built once.
const writtenTaps = new WeakMap<THREE.Texture, { storage: WebGLTexture; taps: number }>();

/**
 * Whether `texture` samples on an anisotropic row (`material_storage.cpp:2489-2504`). Only those
 * rows upload more than one tap (`godotTextureFilterState`).
 */
function isAnisotropic(texture: THREE.Texture): boolean {
  return texture.anisotropy > 1;
}

function tapsUnderWay(texture: THREE.Texture): number {
  return levelUnderWay === null ? texture.anisotropy : 1 << levelUnderWay;
}

function maxAnisotropyParameter(renderer: THREE.WebGLRenderer): number | null {
  // three returns null for an extension the GPU lacks, which has no taps to write then.
  const extension = renderer.extensions.get(
    'EXT_texture_filter_anisotropic'
  ) as EXT_texture_filter_anisotropic | null;
  return extension?.TEXTURE_MAX_ANISOTROPY_EXT ?? null;
}

/**
 * Writes the taps of the draw under way onto the GPU storage of `texture`, binding it through
 * three's state so its binding cache stays true. `isBound`: an upload has just bound it.
 */
function writeTaps(renderer: THREE.WebGLRenderer, texture: THREE.Texture, isBound: boolean): void {
  if (!isAnisotropic(texture)) return;
  const parameter = maxAnisotropyParameter(renderer);
  const storage = handleOf(renderer, texture).__webglTexture;
  if (parameter === null || (!isBound && !storage)) return;
  const taps = Math.min(tapsUnderWay(texture), renderer.capabilities.getMaxAnisotropy());
  const written = writtenTaps.get(texture);
  if (!isBound && written?.storage === storage && written?.taps === taps) return;
  const gl = renderer.getContext();
  if (!isBound) renderer.state.bindTexture(gl.TEXTURE_2D, storage!, gl.TEXTURE0);
  gl.texParameterf(gl.TEXTURE_2D, parameter, taps);
  if (storage) writtenTaps.set(texture, { storage, taps });
}

function writeDrawnTextures(): void {
  for (const [texture, { renderer }] of drawnTextures) writeTaps(renderer, texture, false);
}

/**
 * Runs `draw` with `level` as the anisotropic level of each texture it samples, as each viewport
 * allocates its own samplers (`render_scene_buffers_rd.cpp:120`). Null is a canvas draw. Only
 * `drawWorld` calls it.
 */
export function drawAtAnisotropicLevel(level: number | null, draw: () => void): void {
  const previous = levelUnderWay;
  levelUnderWay = level;
  writeDrawnTextures();
  try {
    draw();
  } finally {
    levelUnderWay = previous;
    writeDrawnTextures();
  }
}

/** Writes the taps of the draw under way onto `texture`, which its caller draws now and holds no hook for. */
export function writeViewportAnisotropy(renderer: THREE.WebGLRenderer, texture: THREE.Texture): void {
  writeTaps(renderer, texture, false);
}

/**
 * Holds a texture drawn inside a Canvas, so each draw writes its taps: at once when its storage
 * exists, as a tiled texture's does, and after each upload three makes. three writes the taps of a
 * linear magnification at upload and none for a nearest one (r187 `WebGLTextures.js:756`). It
 * calls `onUpdate` right after an upload with the texture still bound (`:1461`).
 */
export function useViewportAnisotropy(texture: THREE.Texture | null): void {
  // The store is absent outside a Canvas, where no renderer exists.
  const renderer = useContext(context)?.getState().gl;
  useEffect(() => {
    if (!texture || !renderer) return;
    // Hold even a texture that samples one tap now, as its filter may change later.
    const releaseDrawn = holdDrawn(texture, renderer);
    const releaseUpload = holdUploadWriter(texture, () => writeTaps(renderer, texture, true));
    writeTaps(renderer, texture, false);
    return () => {
      releaseUpload();
      releaseDrawn();
    };
  }, [texture, renderer]);
}

function holdDrawn(texture: THREE.Texture, renderer: THREE.WebGLRenderer): () => void {
  const held = drawnTextures.get(texture) ?? { renderer, holds: 0 };
  held.holds += 1;
  drawnTextures.set(texture, held);
  return () => {
    held.holds -= 1;
    if (held.holds === 0) drawnTextures.delete(texture);
  };
}

interface UploadWriter {
  /** The live holds. Each recomputes the write from the texture, so none goes stale. */
  holds: Set<() => void>;
  /** The callback the texture had before the writer wrapped it. */
  previous: THREE.Texture['onUpdate'];
  wrapper: THREE.Texture['onUpdate'];
}

/**
 * Written only by `holdUploadWriter`: one writer for each texture, however many runs share it, so
 * an upload writes once, through the first live hold. Every hold sits on one renderer: no texture
 * is shared across Canvases. The last hold to let go clears the entry.
 */
// eslint-disable-next-line no-restricted-syntax -- it keeps the live holds, and the last release deletes the entry
const uploadWriters = new WeakMap<THREE.Texture, UploadWriter>();

/** Wraps `onUpdate` of `texture` so an upload writes through the first live hold. */
function wrapUpload(texture: THREE.Texture): UploadWriter {
  const previous = texture.onUpdate;
  const holds = new Set<() => void>();
  const wrapper: THREE.Texture['onUpdate'] = (uploaded) => {
    previous?.(uploaded);
    const [firstHold] = holds;
    firstHold?.();
  };
  texture.onUpdate = wrapper;
  return { holds, previous, wrapper };
}

/**
 * Opens a hold on the upload writer of `texture` and returns the release. `write` reads the texture
 * afresh.
 */
function holdUploadWriter(texture: THREE.Texture, write: () => void): () => void {
  const held = uploadWriters.get(texture) ?? wrapUpload(texture);
  uploadWriters.set(texture, held);
  held.holds.add(write);
  return () => {
    held.holds.delete(write);
    if (held.holds.size > 0) return;
    uploadWriters.delete(texture);
    // Another hook may have wrapped this one since: its chain still reaches ours, so leave it.
    if (texture.onUpdate === held.wrapper) texture.onUpdate = held.previous;
  };
}
