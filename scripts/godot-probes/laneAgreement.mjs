/**
 * The one rule by which a result lane agrees with Godot's: its bits equal Godot's, or, in a float
 * lane, both are NaN. GLSL ES 3.00 section 4.5.1 leaves a NaN's sign and payload to the device,
 * and lavapipe gives a NaN another sign on an AVX-512 CPU than on an AVX2 one.
 */

import { PROBE_TYPES, probeSignature } from './probeShader.mjs';

/** Whether the probe of `source` returns floats, whose NaN lanes agree whatever their bits. */
export const returnsFloat = (source) => PROBE_TYPES[probeSignature(source).returns].scalar === 'float';

/** Whether lane bits `bits` are a NaN of any sign and payload. */
export const isNaNBits = (bits) => (bits & 0x7f800000) === 0x7f800000 && (bits & 0x7fffff) !== 0;

/** Whether lane bits `got` agree with Godot's `want`. An int, uint or bool lane agrees bit for bit. */
export const lanesAgree = (want, got, isFloat) =>
  want === got || (isFloat && isNaNBits(want) && isNaNBits(got));
