/**
 * Godot's LTC tables, the linearly transformed cosine fit an area light's specular reads
 * (`area_lights_inc.glsl:325-341`, 4.7.2). A read at `(roughness, view angle)` is Godot's read.
 */

import { LTC_LUT1_RESIDUALS, LTC_LUT2_RESIDUALS, LTC_SHAPE } from './ltcTable.generated.js';
import { fromResiduals } from '../tableResiduals.js';

/** The two tables, RGBA floats per texel: a row per view angle and a column per roughness. */
interface LtcTables {
  /** The fit's matrix entries `a, b, c, d`. */
  lut1: Float32Array;
  /** The fit's `e` and its two Fresnel weights, then an unused channel. */
  lut2: Float32Array;
}

export function ltcTables(): LtcTables {
  return { lut1: floatsOf(LTC_LUT1_RESIDUALS), lut2: floatsOf(LTC_LUT2_RESIDUALS) };
}

/** The floats whose bit patterns the residuals hold. */
function floatsOf(residuals: readonly number[]): Float32Array {
  const bits = fromResiduals(residuals, LTC_SHAPE, new Uint32Array(residuals.length));
  return new Float32Array(bits.buffer);
}
