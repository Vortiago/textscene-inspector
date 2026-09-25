/**
 * `Environment.tonemap_mode` → three's tone mapping. Godot's curves, AgX included, are
 * not three's, so the ports in `godotToneMapping.ts` install through
 * `THREE.CustomToneMapping`, three's documented hook for this.
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
  /** Godot's `env->white`, the value the curve maps to 1.0. Default 1.0. */
  white?: number;
  /** Godot `tonemap_agx_contrast`, default 1.25. Read only under AGX. */
  agxContrast?: number;
}

/** The chunk name three expands into every material's fragment shader. */
const TONEMAP_CHUNK = 'tonemapping_pars_fragment';

/**
 * LINEAR maps to `NoToneMapping`, and three applies `toneMappingExposure` only
 * inside a tone curve, so a `tonemap_exposure` authored under LINEAR is
 * dropped. Faithful at the 1.0 default.
 */
export function toneMappingFor(mode: number): THREE.ToneMapping {
  if (mode === GodotToneMapper.LINEAR) return THREE.NoToneMapping;
  return hasGodotCurve(mode) ? THREE.CustomToneMapping : THREE.NoToneMapping;
}

/**
 * Applies a tonemapper and returns the undo, as the renderer and three's shader chunks
 * outlive an environment. `THREE.ShaderChunk` is module-global, so one environment applies
 * at a time: the web app mounts one shell, each VS Code webview is its own realm, and
 * Godot allows one `WorldEnvironment` per scene. With two, last mount wins, as in Godot.
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
    keyProgramsOnToneMappingChunk();
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

/**
 * The program-key term for the curve three would compile into `material` now, and empty for a
 * material that is not tone-mapped, which never compiles the chunk. three 0.186.0 keys a program on
 * the `renderer.toneMapping` enum (`WebGLPrograms.js:490`) and reads the chunk only at compile
 * (`WebGLProgram.js:775`), so without this term two curves share one program.
 */
export function toneMappingProgramKey(material: Pick<THREE.Material, 'toneMapped'>): string {
  if (!material.toneMapped) return '';
  return `,toneMappingChunk:${chunkId(THREE.ShaderChunk[TONEMAP_CHUNK])}`;
}

const threeCustomProgramCacheKey = THREE.Material.prototype.customProgramCacheKey;

/**
 * Adds `toneMappingProgramKey` to three's own key, so a material marked dirty compiles the new
 * curve. On the prototype, as the renderer's own background materials are reachable no other way.
 * A material with its own `customProgramCacheKey` shadows this, so it appends this key itself
 * (`materialProgramInputs.ts`).
 */
function keyProgramsOnToneMappingChunk(): void {
  THREE.Material.prototype.customProgramCacheKey = customProgramCacheKeyWithChunk;
}

function customProgramCacheKeyWithChunk(this: THREE.Material): string {
  return threeCustomProgramCacheKey.call(this) + toneMappingProgramKey(this);
}

/** Written only by `chunkId`. Never cleared, since a session installs a handful of curves. */
const chunkIds = new Map<string, number>();

/** A short stand-in for a chunk text in a program key. Equal texts get equal ids. */
function chunkId(chunk: string): number {
  let id = chunkIds.get(chunk);
  if (id === undefined) {
    id = chunkIds.size;
    chunkIds.set(chunk, id);
  }
  return id;
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
