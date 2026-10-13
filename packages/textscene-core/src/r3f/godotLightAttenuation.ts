/**
 * Godot's attenuation of an omni and a spot light in three's lighting chunks
 * (`scene_forward_lights_inc.glsl:428-435`, `:755-766`). three fades a spot light's cone with a
 * smoothstep across its penumbra, and Godot with a power of the angle from the axis.
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from './shaderPatch/chunkPatch.js';

/**
 * Godot's distance falloff. three's own clamps the falloff at 100, where Godot clamps the distance
 * at 0.0001.
 */
const DISTANCE_EDIT: ChunkEdit<'lights_pars_begin'> = {
  chunk: 'lights_pars_begin',
  three: 'float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );',
  godot: 'float distanceFalloff = pow( max( lightDistance, 0.0001 ), - decayExponent );',
};

/**
 * Godot's cone, from the axis to the edge. three carries no cone exponent, so `godotConePenumbra`
 * writes it into the penumbra's cosine `c`, as `-c / sqrt( 1 - c * c )`. A negative exponent darkens
 * the cone, as in Godot.
 */
const SPOT_CONE = /* glsl */ `float exponent = - penumbraCosine / max( sqrt( 1.0 - penumbraCosine * penumbraCosine ), 1e-6 );
	float rim = max( 1e-4, ( 1.0 - max( angleCosine, coneCosine ) ) / ( 1.0 - coneCosine ) );
	return 1.0 - pow( rim, exponent );`;

const ATTENUATION_EDITS: readonly ChunkEdit<'lights_pars_begin'>[] = [
  DISTANCE_EDIT,
  {
    chunk: 'lights_pars_begin',
    three: 'return smoothstep( coneCosine, penumbraCosine, angleCosine );',
    godot: SPOT_CONE,
  },
  {
    chunk: 'lights_pars_begin',
    three: 'if ( spotAttenuation > 0.0 ) {',
    godot: 'if ( spotAttenuation != 0.0 ) {',
  },
];

/**
 * The `penumbra` of a three `SpotLight` whose `angle` is `angle` radians, which carries Godot's cone
 * exponent, the inverse of `spot_angle_attenuation` (`light_storage.cpp:914`), to the patched chunk.
 */
export function godotConePenumbra(angle: number, angleAttenuation: number): number {
  if (angle === 0) return 0;
  const exponent = 1 / angleAttenuation;
  const cosine = Number.isFinite(exponent) ? -exponent / Math.hypot(1, exponent) : -Math.sign(exponent);
  return 1 - Math.acos(cosine) / angle;
}

/**
 * Replaces three's attenuation for every program compiled after the call. A three release that
 * rewrites a replaced line keeps its chunk, and `godotLightAttenuation.test.ts` fails on that
 * release. A second call changes nothing.
 */
export function installGodotLightAttenuation(): void {
  installChunkPatch({
    names: ['lights_pars_begin'],
    isApplied: (chunks) => chunks.lights_pars_begin.includes(SPOT_CONE),
    apply: (chunks) => applyChunkEdits(chunks, ATTENUATION_EDITS),
    missing: 'lights_pars_begin lacks a line the light attenuation patch replaces',
  });
}
