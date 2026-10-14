/**
 * Godot's two specialisation constants for the blocker search, `sc_use_light_soft_shadows` and
 * `sc_use_directional_soft_shadows` (`scene_forward_clustered_inc.glsl:85-91`), as defines on every
 * lit material. A program without one compiles no search, so it binds no sampler for an atlas's
 * colour: a fragment shader has 16 texture units, and a material with many maps needs them all.
 */

import type * as THREE from 'three';

export const LIGHT_SOFT_SHADOWS = 'GODOT_USE_LIGHT_SOFT_SHADOWS';
export const DIRECTIONAL_SOFT_SHADOWS = 'GODOT_USE_DIRECTIONAL_SOFT_SHADOWS';

/** Which searches a scene's lights need for one render. */
export interface SoftShadowSearch {
  /** An omni, spot or area light searches for blockers (`softShadowRadius.ts`). */
  positional: boolean;
  /** A directional light turns Godot's directional soft shadows on (`sunSoftShadow.ts`). */
  directional: boolean;
}

/**
 * Each scene's needs at its last render. Written only by `defineSoftShadowSearch` and
 * `releaseSoftShadowSearch`. A material two scenes share would compile again on each scene's render
 * if each defined only its own needs, so every scene defines what any scene needs.
 */
const sceneSearches = new Map<THREE.Object3D, SoftShadowSearch>();

/** three's own test for a material that reads the lights (r186 `WebGLRenderer.js:2855-2861`). */
function readsLights(material: THREE.Material): boolean {
  const flags = material as THREE.Material & {
    isMeshLambertMaterial?: boolean;
    isMeshToonMaterial?: boolean;
    isMeshPhongMaterial?: boolean;
    isMeshStandardMaterial?: boolean;
    isShadowMaterial?: boolean;
    isShaderMaterial?: boolean;
    lights?: boolean;
  };
  return (
    flags.isMeshLambertMaterial === true ||
    flags.isMeshToonMaterial === true ||
    flags.isMeshPhongMaterial === true ||
    flags.isMeshStandardMaterial === true ||
    flags.isShadowMaterial === true ||
    (flags.isShaderMaterial === true && flags.lights === true)
  );
}

function neededSearch(): SoftShadowSearch {
  let positional = false;
  let directional = false;
  for (const search of sceneSearches.values()) {
    positional ||= search.positional;
    directional ||= search.directional;
  }
  return { positional, directional };
}

type DefinedMaterial = THREE.Material & { defines?: Record<string, unknown> };

/**
 * Sets or removes `name`, and marks the material for a new program when that changes it. Materials
 * may share one `defines` object, so each change writes a new one.
 */
function syncDefine(material: DefinedMaterial, name: string, isDefined: boolean): void {
  const defines = material.defines ?? {};
  if (name in defines === isDefined) return;
  const { [name]: _removed, ...kept } = defines;
  material.defines = isDefined ? { ...kept, [name]: '' } : kept;
  material.needsUpdate = true;
}

function defineOn(material: THREE.Material, search: SoftShadowSearch): void {
  if (!readsLights(material)) return;
  syncDefine(material, LIGHT_SOFT_SHADOWS, search.positional);
  syncDefine(material, DIRECTIONAL_SOFT_SHADOWS, search.directional);
}

/**
 * Records `scene`'s needs, and defines what any scene needs on every lit material of `scene`. The
 * scene's light pass calls it before each render, so a material added since takes the defines
 * before its first draw.
 */
export function defineSoftShadowSearch(scene: THREE.Object3D, search: SoftShadowSearch): void {
  sceneSearches.set(scene, search);
  const needed = neededSearch();
  scene.traverse((object) => {
    const { material } = object as { material?: THREE.Material | THREE.Material[] };
    if (Array.isArray(material)) for (const each of material) defineOn(each, needed);
    else if (material) defineOn(material, needed);
  });
}

/** Forgets `scene`'s needs, once its light pass stops. */
export function releaseSoftShadowSearch(scene: THREE.Object3D): void {
  sceneSearches.delete(scene);
}
