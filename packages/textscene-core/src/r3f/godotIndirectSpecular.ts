/**
 * Godot's weights for a specular reflection in three's lighting chunks: its own DFG table
 * (`godot/rendering/materials/dfg.ts`), the indirect specular Godot builds from it (`scene_forward_clustered.glsl:2221-2231`),
 * the compensation for the light that scatters more than once, on the direct specular too, and the
 * occlusion of a reflection by a dim ambient. three reads a coarser table of another geometry term,
 * adds the multiple scattering from the irradiance, and occludes a reflection by the AO map alone.
 */

import * as THREE from 'three';
import { dfgHalfFloats } from '../godot/rendering/materials/dfg.js';
import { DFG_SIZE } from '../godot/rendering/materials/dfgTable.generated.js';
import { applyChunkEdits, installChunkPatch, type ChunkEdit, type Chunks } from './shaderPatch/chunkPatch.js';
import { installLitUniform } from './shaderPatch/litUniform.js';
import { releasedOnUnmount, sharedTexture } from './sharedTexture.js';
import { defining, type ProgramInjection } from './materialProgramInputs.js';
import { recordedOn } from './materials/recordedOnMaterial.js';

type SpecularChunk = 'lights_physical_pars_fragment' | 'lights_fragment_begin' | 'aomap_fragment';

const DFG_UNIFORM = 'godotDfgTable';

const MATERIAL_STRUCT = 'struct PhysicalMaterial {';

const THREE_DFG = 'material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;';

/** `prefiltered_dfg` (`scene_forward_clustered_inc.glsl:482-484`) at Godot's clamped N.V (`:2224`). */
const GODOT_DFG = /* glsl */ `${THREE_DFG}
	material.godotDfg = texture2D( ${DFG_UNIFORM}, vec2( clamp( dot( geometryNormal, geometryViewDir ), 0.0001, 1.0 ), material.godotRoughness ) ).rg;`;

/**
 * `F0` (`scene_forward_lights_inc.glsl:55-58`) is three's blended specular colour, and Godot's f90
 * for an indirect specular is `50 * f0.g` (`scene_forward_clustered.glsl:2230`). A toon surface
 * weighs it by `specular * metallic * albedo * 2` instead (`:2219-2220`). three's dielectric
 * specular colour is Godot's `0.16 * specular * specular` (`materialBag.ts`), which gives `specular`.
 */
const GODOT_INDIRECT_SPECULAR = /* glsl */ `#ifdef GODOT_DIFFUSE_TOON
	vec3 indirectSpecular = radiance * sqrt( material.specularColor.g / 0.16 ) * material.metalness * material.diffuseColor * 2.0;
	#else
	vec3 godotF0 = material.specularColorBlended;
	float godotF90 = clamp( 50.0 * godotF0.g, material.metalness, 1.0 );
	vec3 godotEnergyCompensation = 1.0 + godotF0 * ( 1.0 / material.godotDfg.y - 1.0 );
	vec3 indirectSpecular = radiance * godotEnergyCompensation * ( ( godotF90 - godotF0 ) * material.godotDfg.x + godotF0 * material.godotDfg.y );
	#endif`;

/**
 * three's occlusion of a reflection by the AO map alone, the clearcoat's included, each line apart:
 * the built chunks drop blank lines. Godot occludes every reflection by the ambient instead.
 */
const THREE_REFLECTION_OCCLUSION = [
  'clearcoatSpecularIndirect *= ambientOcclusion;',
  'float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );',
  'reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );',
];

/** The define of a material whose `disable_specular_occlusion` is set (`material.cpp:896`). */
const OCCLUSION_DISABLED_DEFINE = 'GODOT_SPECULAR_OCCLUSION_DISABLED';

/**
 * Godot's occlusion of a reflection by the luminance of the ambient light, after the AO map
 * (`scene_forward_clustered.glsl:2119-2162`): a dim ambient dims a rough or dielectric reflection,
 * and a smooth metal keeps more of it, with or without a sky, as a ReflectionProbe reflects without
 * one. Godot's ambient is three's irradiance over PI.
 */
const GODOT_SPECULAR_OCCLUSION = /* glsl */ `
#if defined( STANDARD ) && ! defined( ${OCCLUSION_DISABLED_DEFINE} )

	#ifdef USE_AOMAP
		float godotAmbientOcclusion = ambientOcclusion;
	#else
		float godotAmbientOcclusion = 1.0;
	#endif
	vec3 godotAmbientLight = ( irradiance + iblIrradiance ) * RECIPROCAL_PI * godotAmbientOcclusion;
	float godotSpecularOcclusion = min( dot( godotAmbientLight, vec3( 0.3, 0.59, 0.11 ) ) * 8.0, 1.0 );
	float godotReflective = ( 1.0 - material.godotRoughness ) * material.metalness;
	godotSpecularOcclusion = max( min( godotReflective * godotSpecularOcclusion * 10.0, 1.0 ), godotSpecularOcclusion );
	reflectedLight.indirectSpecular *= godotSpecularOcclusion;

#endif
`;

/** What a material with `disable_specular_occlusion` set compiles with. */
export const SPECULAR_OCCLUSION_DISABLED: ProgramInjection = defining(OCCLUSION_DISABLED_DEFINE);

/** Where a material records `disable_specular_occlusion`, for a draw that shades it again. */
const OCCLUSION_DISABLED_KEY = 'godotSpecularOcclusionDisabled';

export function specularOcclusionUserData(isDisabled: boolean): Record<string, unknown> {
  return { [OCCLUSION_DISABLED_KEY]: isDisabled };
}

/** Whether `material` records `disable_specular_occlusion`: false, Godot's default, for no record. */
export function disablesSpecularOcclusion(material: THREE.Material | undefined): boolean {
  return !!material && recordedOn(material, OCCLUSION_DISABLED_KEY, false);
}

const EDITS: readonly ChunkEdit<SpecularChunk>[] = [
  {
    chunk: 'lights_physical_pars_fragment',
    three: MATERIAL_STRUCT,
    godot: `uniform sampler2D ${DFG_UNIFORM};\n\n${MATERIAL_STRUCT}\n\tvec2 godotDfg;`,
  },
  { chunk: 'lights_fragment_begin', three: THREE_DFG, godot: GODOT_DFG },
  {
    chunk: 'lights_fragment_begin',
    three:
      'material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );',
    godot:
      'material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / material.godotDfg.y - 1.0 );',
  },
  {
    chunk: 'lights_physical_pars_fragment',
    three:
      'vec3 indirectSpecular = radiance * singleScattering;\n\tindirectSpecular += multiScattering * cosineWeightedIrradiance;',
    godot: GODOT_INDIRECT_SPECULAR,
  },
  ...THREE_REFLECTION_OCCLUSION.map((three) => ({ chunk: 'aomap_fragment' as const, three, godot: '' })),
];

/** The chunks with every edit, and Godot's occlusion after three's AO, which every lit program runs. */
function withSpecularOcclusion(chunks: Chunks<SpecularChunk>): Chunks<SpecularChunk> | null {
  const patched = applyChunkEdits(chunks, EDITS);
  if (patched === null) return null;
  return { ...patched, aomap_fragment: `${patched.aomap_fragment}${GODOT_SPECULAR_OCCLUSION}` };
}

/**
 * Godot's table as a texture, read at `(NdotV, roughness)` with Godot's linear clamped sampler. It is
 * shared, not cloned per material, so the release on unmount frees the one object each renderer uploads.
 */
class DfgTexture extends sharedTexture(THREE.DataTexture) {
  constructor() {
    super(dfgHalfFloats(), DFG_SIZE, DFG_SIZE, THREE.RGFormat, THREE.HalfFloatType);
    this.magFilter = THREE.LinearFilter;
    this.minFilter = THREE.LinearFilter;
    this.needsUpdate = true;
  }
}

/**
 * Replaces three's specular weights and gives the table to every built-in lit material, for every
 * program compiled after the call. A three release that rewrites a replaced line keeps all its
 * chunks, and `godotIndirectSpecular.test.ts` fails on that release. A second call changes nothing.
 */
export function installGodotIndirectSpecular(): void {
  const isPatched = installChunkPatch({
    names: ['lights_physical_pars_fragment', 'lights_fragment_begin', 'aomap_fragment'],
    isApplied: (chunks) => chunks.lights_physical_pars_fragment.includes(GODOT_INDIRECT_SPECULAR),
    apply: withSpecularOcclusion,
    missing:
      'lights_physical_pars_fragment, lights_fragment_begin or aomap_fragment lacks a text the specular patch replaces',
  });
  if (isPatched) installLitUniform(DFG_UNIFORM, releasedOnUnmount(new DfgTexture()));
}
