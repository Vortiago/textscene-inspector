/**
 * The surface outputs: the values Godot's `fragment()` writes for the light to read
 * (`scene_forward_clustered.glsl:1100-1650`). The lighting model reads only these, so a material
 * that fills them from its own inputs draws with Godot's light.
 */

import type { Transmittance } from './brdf.js';
import type { Anisotropy } from './lightFunctions.js';
import type { FloatNode, Vec3Node } from './nodeTypes.js';

export interface SurfaceOutputs {
  albedo: Vec3Node;
  metallic: FloatNode;
  roughness: FloatNode;
  specular: FloatNode;
  /** `AO`, and `AO_LIGHT_AFFECT`: how much of it reaches the direct light. */
  ao: FloatNode;
  aoLightAffect: FloatNode;
  /** `diffuse_mode` and `specular_mode`, which pick the program's branches as Godot's defines do. */
  diffuseMode: number;
  specularMode: number;
  /** `CLEARCOAT` and `CLEARCOAT_ROUGHNESS`, under `LIGHT_CLEARCOAT_USED`. */
  clearcoat?: { amount: FloatNode; roughness: FloatNode };
  /** `RIM` and `RIM_TINT`, under `LIGHT_RIM_USED`. */
  rim?: { amount: FloatNode; tint: FloatNode };
  /** `BACKLIGHT`, under `LIGHT_BACKLIGHT_USED`. */
  backlight?: Vec3Node;
  /** Under `LIGHT_TRANSMITTANCE_USED`. */
  transmittance?: Transmittance;
  /** The tangent frame and `ANISOTROPY`, under `LIGHT_ANISOTROPY_USED`. */
  anisotropy?: Anisotropy;
}
