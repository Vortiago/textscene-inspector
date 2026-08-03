/**
 * `Environment.tonemap_mode` → three's tone mapping.
 *
 * Godot's curves are not three's. Measured against a Godot render of the same
 * fixture, mapping FILMIC onto three's nearest built-in (Cineon) left every lit
 * surface at ~0.87 of Godot's value — a flat, luminance-independent error, i.e.
 * the wrong curve rather than the wrong lighting. So the curves are ported and
 * installed through `THREE.CustomToneMapping`, three's documented hook for
 * exactly this (`godotToneMapping.ts`).
 *
 * AGX is ported too: three's own AgX is a different approximation of EaryChow's
 * (a log2 EV encoding with a polynomial sigmoid) and renders shadows visibly
 * dimmer than Godot's harder toe, so it goes through `CustomToneMapping` with
 * Godot 4.6's `allenwp_curve` like the rest (`godotToneMapping.ts`).
 */

import * as THREE from 'three';
import { glslFloat } from './glslLiterals';
import {
  GodotToneMapper,
  hasGodotCurve,
  toneMappingShaderChunk,
  toneMappingWhiteParam,
} from './godotToneMapping';

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
  /** Godot's `env->white` — the value the curve maps to 1.0. Default 1.0. */
  white?: number;
  /** Godot `tonemap_agx_contrast`, default 1.25. Read only under AGX. */
  agxContrast?: number;
}

/** The chunk name three expands into every material's fragment shader. */
const TONEMAP_CHUNK = 'tonemapping_pars_fragment';

export function toneMappingFor(mode: number): THREE.ToneMapping {
  if (mode === GodotToneMapper.LINEAR) return THREE.NoToneMapping;
  return hasGodotCurve(mode) ? THREE.CustomToneMapping : THREE.NoToneMapping;
}

/**
 * Applies a tonemapper to the renderer and returns the undo. Restoring on
 * unmount matters because the renderer, the scene and three's shader chunks all
 * outlive any one environment: a previewer that swaps scenes would otherwise
 * keep the departed environment's curve.
 *
 * `THREE.ShaderChunk` is module-global, so this assumes ONE environment applies
 * at a time. That holds: the web app mounts a single shell, each VS Code
 * webview is its own realm, and Godot allows only one `WorldEnvironment` per
 * scene (it warns otherwise). A scene that ships two anyway gets last-mount-
 * wins, which is also what Godot's own renderer does with them.
 */
export function applyToneMapping(
  gl: ToneMappedRenderer,
  settings: ToneMappingSettings,
  scene?: THREE.Object3D
): () => void {
  const previousMapping = gl.toneMapping;
  const previousExposure = gl.toneMappingExposure;
  const previousChunk = THREE.ShaderChunk[TONEMAP_CHUNK];

  const mapping = toneMappingFor(settings.mode);
  const exposure = settings.exposure ?? 1;
  const custom = mapping === THREE.CustomToneMapping;

  if (custom) {
    // The white normalisation is a constant per environment, so it is baked
    // into the chunk rather than plumbed through as a uniform every material
    // would have to declare.
    THREE.ShaderChunk[TONEMAP_CHUNK] = toneMappingShaderChunk(
      settings.mode,
      settings.agxContrast
    ).replace(
      'uniform float godotToneMapWhite;',
      `const float godotToneMapWhite = ${glslFloat(
        toneMappingWhiteParam(settings.mode, settings.white ?? 1)
      )};`
    );
  }

  const changed = mapping !== previousMapping || custom;
  if (mapping !== previousMapping) gl.toneMapping = mapping;
  if (exposure !== previousExposure) gl.toneMappingExposure = exposure;
  if (changed) markMaterialsDirty(scene);

  return () => {
    THREE.ShaderChunk[TONEMAP_CHUNK] = previousChunk;
    if (gl.toneMapping !== previousMapping) gl.toneMapping = previousMapping;
    if (gl.toneMappingExposure !== previousExposure) gl.toneMappingExposure = previousExposure;
    if (changed) markMaterialsDirty(scene);
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
