/**
 * `FogMaterial`, the material a FogVolume fills its shape with. Godot's built-in fog shader reads
 * these terms (`scene/resources/3d/fog_material.cpp:149-163`).
 */

import type { Rgba } from '../../../godot/math/math';
import type { ScopedReference } from '../../reading';

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

/**
 * What fills a FogVolume. Godot runs its default fog shader for anything but a FogMaterial or a
 * valid fog shader (`environment/fog.cpp:674-684`).
 */
export type FogVolumeMaterial =
  | {
      kind: 'material';
      material: FogMaterialData;
      /** The `density_texture`, with the tables of the FogMaterial it is written in. Null when unwritten. */
      densityTexture: ScopedReference | null;
    }
  /** A fog shader, which the previewer does not run. `shader` is the reference as written. */
  | { kind: 'shader'; shader: string }
  | { kind: 'default' };
