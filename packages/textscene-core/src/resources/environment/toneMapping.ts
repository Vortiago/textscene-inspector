/**
 * The root world's tone mapping. Every tone mapper, LINEAR included, draws through three's
 * `CustomToneMapping` hook with Godot's own curve from `godotToneMapping.ts`, because Godot
 * multiplies by `tonemap_exposure` before every curve (`tonemap.glsl:868-874`) and three applies
 * `toneMappingExposure` only inside a curve.
 */

import * as THREE from 'three';
import { applyEdits, installChunkPatch, onChunk, type ChunkPatch } from '../../r3f/shaderPatch/chunkPatch';
import { customToneMappingFunction } from './godotToneMapping';

/** The subset of `THREE.WebGLRenderer` this module touches. */
interface ToneMappedRenderer {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

interface ToneMappingSettings {
  /** Godot `tonemap_mode`: 0 LINEAR, 1 REINHARDT, 2 FILMIC, 3 ACES, 4 AGX. */
  mode: number;
  /** Godot `tonemap_exposure`, default 1.0. */
  exposure?: number;
  /** Godot's `env->white`, the value the curve maps to 1.0. Default 1.0. */
  white?: number;
  /** Godot `tonemap_agx_contrast`, default 1.25. Read only under AGX. */
  agxContrast?: number;
}

/**
 * Who draws the root world's own frame through the curve: three, per material, or the
 * compositor's tone pass, which holds the renderer at `NoToneMapping` while it is mounted.
 */
export type ToneMapRoute = 'material' | 'compositor';

/**
 * The mapping a pass that renders the shared world applies: a `SubViewport` target, which Godot
 * tonemaps with the environment of its `find_world_3d()`. It draws the curve the root world
 * installed on either route, which is LINEAR at exposure 1 for a root with no Environment.
 */
export const SHARED_WORLD_TONE_MAPPING = THREE.CustomToneMapping;

/** The chunk name three expands into every material's fragment shader. */
const TONEMAP_CHUNK = 'tonemapping_pars_fragment';

/** three's identity stub, the one `CustomToneMapping` the curve replaces. */
const CUSTOM_TONE_MAPPING_STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

/**
 * three's chunk as it loads, before any curve. Every curve is spliced into this text, so a curve
 * installed over another needs no stub of its own.
 */
const THREE_TONEMAP_CHUNK = THREE.ShaderChunk[TONEMAP_CHUNK];

/**
 * Installs the curve and its exposure for every pass that renders the root world, and on the
 * material route the renderer's mapping too. Returns the undo, as the renderer and three's chunks
 * outlive an environment. `THREE.ShaderChunk` is module-global, so only the root world's
 * Environment installs (`r3f/environment/EnvironmentLayer.tsx`).
 */
export function installToneMapping(
  gl: ToneMappedRenderer,
  settings: ToneMappingSettings,
  route: ToneMapRoute,
  scene?: THREE.Object3D
): () => void {
  const restoreCurve = installCurve(gl, settings);
  const restoreMapping = route === 'material' ? drawThroughCurve(gl) : undefined;
  markMaterialsDirty(scene);
  return () => {
    restoreMapping?.();
    restoreCurve();
    markMaterialsDirty(scene);
  };
}

/**
 * Marks `scene`'s materials dirty when the installed curve changed since `seen`, so a scene the
 * install never walks, such as a sub-viewport's portal, compiles the new curve. `seen` belongs to
 * the caller and starts at -1.
 */
export function recompileOnCurveChange(scene: THREE.Object3D, seen: { revision: number }): void {
  if (seen.revision === curveRevision) return;
  seen.revision = curveRevision;
  markMaterialsDirty(scene);
}

/** Written only by `setCurveChunk`, once per change to three's chunk. Never cleared. */
let curveRevision = 0;

/** Puts the settings' curve in three's chunk and their exposure on the renderer. Returns the undo. */
function installCurve(gl: ToneMappedRenderer, settings: ToneMappingSettings): () => void {
  const previousExposure = gl.toneMappingExposure;
  const previousChunk = THREE.ShaderChunk[TONEMAP_CHUNK];
  keyProgramsOnToneMappingChunk();
  setCurveChunk(
    curveChunk(customToneMappingFunction(settings.mode, settings.white ?? 1, settings.agxContrast))
  );
  gl.toneMappingExposure = settings.exposure ?? 1;
  return () => {
    setCurveChunk(previousChunk);
    gl.toneMappingExposure = previousExposure;
  };
}

/** three's chunk with `curve` in place of the stub, or null when three's chunk holds no stub once. */
function curveChunk(curve: string): string | null {
  return applyEdits(THREE_TONEMAP_CHUNK, [{ three: CUSTOM_TONE_MAPPING_STUB, godot: curve }]);
}

/** The patch that makes three's chunk `chunk`, or warns and keeps it for null. */
function chunkPatchTo(chunk: string | null): ChunkPatch<typeof TONEMAP_CHUNK> {
  return {
    names: [TONEMAP_CHUNK],
    isApplied: (chunks) => chunks[TONEMAP_CHUNK] === chunk,
    apply: onChunk(TONEMAP_CHUNK, () => chunk),
    missing: `${TONEMAP_CHUNK} lacks the stub ${CUSTOM_TONE_MAPPING_STUB}`,
  };
}

/** An exposure-only change reinstalls the same text, which no program needs to recompile for. */
function setCurveChunk(chunk: string | null): void {
  if (THREE.ShaderChunk[TONEMAP_CHUNK] === chunk) return;
  if (installChunkPatch(chunkPatchTo(chunk))) curveRevision += 1;
}

/** Points the renderer's own mapping at the installed curve. Returns the undo. */
function drawThroughCurve(gl: ToneMappedRenderer): () => void {
  const previousMapping = gl.toneMapping;
  gl.toneMapping = THREE.CustomToneMapping;
  return () => {
    gl.toneMapping = previousMapping;
  };
}

/**
 * The program-key term for the curve three would compile into `material` now, and empty for a
 * material that is not tone-mapped, which never compiles the chunk. three 0.186.0 keys a program on
 * the `renderer.toneMapping` enum (`WebGLPrograms.js:490`) and reads the chunk only at compile
 * (`WebGLProgram.js:775`), so without this term two curves share one program.
 */
function toneMappingProgramKey(material: Pick<THREE.Material, 'toneMapped'>): string {
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
