import { PROBE_TYPES, probeSignature } from './probeShader.mjs';

/** Whether the probe of `source` returns floats, whose NaN lanes agree whatever their bits. */
export const returnsFloat = (source) => PROBE_TYPES[probeSignature(source).returns].scalar === 'float';

/** Whether lane bits `bits` are a NaN of any sign and payload. */
export const isNaNBits = (bits) => (bits & 0x7f800000) === 0x7f800000 && (bits & 0x7fffff) !== 0;

/** Whether lane bits `got` agree with Godot's `want`. An int, uint or bool lane agrees bit for bit. */
export const lanesAgree = (want, got, isFloat) =>
  want === got || (isFloat && isNaNBits(want) && isNaNBits(got));
