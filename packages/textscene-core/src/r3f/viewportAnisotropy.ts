import { useContext, useEffect } from 'react';
import type * as THREE from 'three';
import { context } from '@react-three/fiber';
import { handleOf } from './sharedTexture';

/** Written only by `drawAtAnisotropicLevel`. Null: default samplers (`renderer_canvas_render_rd.cpp:460`). */
let levelUnderWay: number | null = null;

/** Each drawn texture's renderer and its holds. The last release deletes the entry. */
const drawnTextures = new Map<THREE.Texture, { renderer: THREE.WebGLRenderer; holds: number }>();

/** The taps last written to a texture's GPU storage, so a pass at the same level writes nothing. */
// eslint-disable-next-line no-restricted-syntax -- a record each write replaces, not a value built once.
const writtenTaps = new WeakMap<THREE.Texture, { storage: WebGLTexture; taps: number }>();

// Only the anisotropic rows upload more than one tap (`material_storage.cpp:2489-2504`).
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

// Binds through three's state so its binding cache stays true. `isBound`: an upload has just bound it.
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

/** Each viewport allocates its own samplers (`render_scene_buffers_rd.cpp:120`). Null is a canvas draw. */
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

/** For a texture its caller draws now and holds no hook for. */
export function writeViewportAnisotropy(renderer: THREE.WebGLRenderer, texture: THREE.Texture): void {
  writeTaps(renderer, texture, false);
}

/** three skips the taps of a nearest magnification (r187 `WebGLTextures.js:756`). */
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

/** Written only by `holdUploadWriter`. The last hold to let go clears the entry. */
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
