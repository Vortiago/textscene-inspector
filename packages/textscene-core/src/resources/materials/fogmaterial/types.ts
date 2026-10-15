/**
 * `FogMaterial`, the material a FogVolume fills its shape with. Godot's built-in fog shader reads
 * these terms (`scene/resources/3d/fog_material.cpp:149-163`).
 */

import type { Rgba } from '../../../godot/math/math';

export interface FogMaterialData {
  /** The density the volume adds. A negative one removes fog. */
  density: number;
  /** The colour the fog scatters light in, as authored (sRGB). */
  albedo: Rgba;
  /** The light the fog gives off, as authored (sRGB). */
  emission: Rgba;
  /** How fast the density halves per unit above the volume's origin. */
  heightFalloff: number;
  /** The exponent of the fade from the shape's edge towards its middle. */
  edgeFade: number;
  /** The `density_texture` reference as written, or null. */
  densityTexture: string | null;
}
