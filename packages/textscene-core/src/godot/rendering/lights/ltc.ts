/**
 * Godot's LTC tables, the linearly transformed cosine fit an area light's specular reads
 * (`area_lights_inc.glsl:325-341`, 4.7.2). A read at `(roughness, view angle)` is Godot's read.
 */

import { LTC_LUT1_BASE64, LTC_LUT2_BASE64 } from './ltcTable.generated.js';
import { decodeBase64Bytes } from '../../variant/packedBytes.js';

/** The two tables, RGBA floats per texel: a row per view angle and a column per roughness. */
interface LtcTables {
  /** The fit's matrix entries `a, b, c, d`. */
  lut1: Float32Array;
  /** The fit's `e` and its two Fresnel weights, then an unused channel. */
  lut2: Float32Array;
}

export function ltcTables(): LtcTables {
  return { lut1: littleEndianFloats(LTC_LUT1_BASE64), lut2: littleEndianFloats(LTC_LUT2_BASE64) };
}

function littleEndianFloats(base64: string): Float32Array {
  const bytes = decodeBase64Bytes(base64);
  const view = new DataView(bytes.buffer);
  const floats = new Float32Array(bytes.length / 4);
  for (let i = 0; i < floats.length; i += 1) floats[i] = view.getFloat32(i * 4, true);
  return floats;
}
