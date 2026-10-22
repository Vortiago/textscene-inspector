/**
 * A fragment shader as a material's `onBeforeCompile` leaves it, without a GL context, and the
 * patches a test reads off it.
 */

import * as THREE from 'three';
import type { ProgramShader } from '../materialProgramInputs';

/** The program of each three class a Godot surface draws with, by material type. */
const PROGRAM_OF_TYPE: Readonly<
  Record<string, Pick<THREE.ShaderLibShader, 'vertexShader' | 'fragmentShader'>>
> = {
  MeshBasicMaterial: THREE.ShaderLib.basic,
  MeshStandardMaterial: THREE.ShaderLib.standard,
  MeshPhysicalMaterial: THREE.ShaderLib.physical,
};

/** The fragment shader of each three class a Godot surface draws with, by material type. */
export const FRAGMENT_SHADER_OF_TYPE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PROGRAM_OF_TYPE).map(([type, { fragmentShader }]) => [type, fragmentShader])
);

/** The shader resets the alpha to `opacity`, dropping the texture and vertex-colour alpha. */
export const DROPS_ALBEDO_ALPHA = 'diffuseColor.a = opacity;';

/** The shader writes alpha 1 for each fragment the cut keeps. */
export const WRITES_OPAQUE_AFTER_CUT = 'diffuseColor.a = 1.0;';

/** The shader scales the direct light by the AO map's occlusion. */
export const OCCLUDES_DIRECT_LIGHT = 'reflectedLight.directDiffuse *= godotDirectOcclusion;';

/** The shader writes a light's diffuse in Lambert mode, not BaseMaterial3D's default Burley. */
export const DRAWS_LAMBERT_DIFFUSE = '#define GODOT_DIFFUSE_LAMBERT\n';

/** The shader leaves a reflection whole under a dim ambient. */
export const KEEPS_REFLECTION_UNOCCLUDED = '#define GODOT_SPECULAR_OCCLUSION_DISABLED\n';

/** The shader rebuilds a normal map's blue from its red and green, as Godot does. */
export const REBUILDS_NORMAL_MAP_BLUE = '#define USE_PACKED_NORMALMAP\n';

/** The shader scales the tangent and the binormal to unit length each, as Godot's vertex stage does. */
export const UNIT_TANGENT_FRAME =
  'return mat3( lengthT == 0.0 ? vec3( 0.0 ) : T / lengthT, lengthB == 0.0 ? vec3( 0.0 ) : B / lengthB, N );';

/** The shader writes a light's specular in toon mode, not BaseMaterial3D's default GGX. */
export const DRAWS_TOON_SPECULAR = '#define GODOT_SPECULAR_TOON\n';

/** `fragmentShader` after `onBeforeCompile`, which reads only the shader, so no renderer is needed. */
export function patchedShader(
  onBeforeCompile: (shader: ProgramShader) => void,
  fragmentShader: string
): string {
  const shader: ProgramShader = { vertexShader: '', fragmentShader, uniforms: {} };
  onBeforeCompile(shader);
  return shader.fragmentShader;
}

export function patchedFragment(material: THREE.Material): string {
  return patchedProgram(material).fragmentShader;
}

/** The uniforms `material`'s `onBeforeCompile` adds. */
export function patchedUniforms(material: THREE.Material): ProgramShader['uniforms'] {
  return patchedProgram(material).uniforms;
}

function patchedProgram(material: THREE.Material): ProgramShader {
  const program = PROGRAM_OF_TYPE[material.type];
  if (program === undefined) {
    throw new Error(`expected a mesh basic, standard or physical material, got ${material.type}`);
  }
  const shader: ProgramShader = { ...program, uniforms: {} };
  material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, undefined as never);
  return shader;
}

/** The texture `material`'s parallax samples, or null when it compiles no parallax. */
export function heightmapSampledBy(material: THREE.Material): THREE.Texture | null {
  return (patchedProgram(material).uniforms.godotHeightmap?.value as THREE.Texture | undefined) ?? null;
}

/** The texture `material` samples as `map`: one of three's map fields, or `heightmap`. */
export function mapSampledBy(material: THREE.Material, map: string): THREE.Texture | null {
  if (map === 'heightmap') return heightmapSampledBy(material);
  return (material as unknown as Record<string, THREE.Texture | null>)[map] ?? null;
}
