/**
 * `Environment.tonemap_mode` → `WebGLRenderer.toneMapping`.
 *
 * Godot's `ToneMapper` and three's tone-mapping constants line up one for one;
 * only the white point (`tonemap_white`) has no three.js counterpart.
 */

import * as THREE from 'three';

/** The subset of `THREE.WebGLRenderer` this module touches. */
export interface ToneMappedRenderer {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

export interface ToneMappingSettings {
  /** Godot `tonemap_mode`: 0 LINEAR, 1 REINHARDT, 2 FILMIC, 3 ACES, 4 AGX. */
  mode: number;
  /** Godot `tonemap_exposure`, default 1.0. */
  exposure?: number;
}

const TONE_MAPPERS: Record<number, THREE.ToneMapping> = {
  0: THREE.NoToneMapping,
  1: THREE.ReinhardToneMapping,
  2: THREE.CineonToneMapping,
  3: THREE.ACESFilmicToneMapping,
  4: THREE.AgXToneMapping,
};

export function toneMappingFor(mode: number): THREE.ToneMapping {
  return TONE_MAPPERS[mode] ?? THREE.NoToneMapping;
}

/**
 * Applies a tonemapper to the renderer and returns the undo. Restoring on
 * unmount matters because the renderer outlives any one scene: a previewer
 * that swaps scenes would otherwise keep the departed environment's curve.
 *
 * `scene` is optional and only used to invalidate compiled programs —
 * three bakes the tonemapper in as a `#define`, so materials already compiled
 * keep rendering the previous curve until they are flagged for recompilation.
 */
export function applyToneMapping(
  gl: ToneMappedRenderer,
  settings: ToneMappingSettings,
  scene?: THREE.Object3D
): () => void {
  const previousMapping = gl.toneMapping;
  const previousExposure = gl.toneMappingExposure;

  const mapping = toneMappingFor(settings.mode);
  const exposure = settings.exposure ?? 1;

  if (mapping !== previousMapping) gl.toneMapping = mapping;
  if (exposure !== previousExposure) gl.toneMappingExposure = exposure;
  if (mapping !== previousMapping) markMaterialsDirty(scene);

  return () => {
    if (gl.toneMapping !== previousMapping) gl.toneMapping = previousMapping;
    if (gl.toneMappingExposure !== previousExposure) gl.toneMappingExposure = previousExposure;
    markMaterialsDirty(scene);
  };
}

function markMaterialsDirty(scene: THREE.Object3D | undefined): void {
  scene?.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (!material) return;
    for (const entry of Array.isArray(material) ? material : [material]) {
      entry.needsUpdate = true;
    }
  });
}
