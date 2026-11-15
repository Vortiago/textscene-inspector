/**
 * The probes that differ from Godot by a known cause, each with the count of lanes off and the
 * first. A listed probe passes only while it differs exactly so, and fails once it equals Godot,
 * so the change that fixes it removes its entry (`coverageFailures` in integration/compare.mjs).
 */

import {
  BOTH_SIDES,
  BROWSER_COMPILER,
  DRIVER_EDGE_CALL,
  DRIVER_NAN_MIX,
  DRIVER_ROUNDED_CALL,
  GODOT_DRIVER,
} from '../driverFolds.mjs';

/**
 * `min`, `max` and `clamp` of a vector and a float keep the sign of a zero and a subnormal on the
 * Godot side, and give +0 on the browser's, where the vector-by-vector overloads are equal on both.
 * three writes the same `min(a, b)` as Godot, so the two drivers' front ends differ.
 */
const SCALAR_BOUND = {
  owner: '#1826',
  cause: 'driver front ends: a float bound of a vector gives +0 for -0 and a subnormal on the browser side',
};

/**
 * Godot leaves the `whole` of `modf(x, whole)` unwritten when nothing reads the call's value: a
 * statement, or a local nothing reads, gives 0 on every input, and `f * 0.0` of the value writes
 * it. Godot's GLSL holds the call (`shader_compiler.cpp:809`), and glslang writes it as
 * `GLSLstd450Modf` with the out pointer (`GlslangToSpv.cpp:8767`), so lavapipe drops the store.
 */
export const UNREAD_MODF = {
  owner: '#1826',
  cause: "driver (Mesa lavapipe) drops the out store of a modf whose value nothing reads, on Godot's side",
};

// ANGLE RewriteDfdy.cpp. Each lane off follows from Godot's own dFdx and dFdy bits.
export const ANGLE_DERIVATIVE = {
  owner: '#1827',
  cause:
    'browser compiler (ANGLE) writes a derivative as dFdx * r.x + dFdy * r.y, so -0 gives +0 and an infinite neighbour NaN',
};

const UNNORMALISED_SUBNORMAL = {
  owner: '#1827',
  cause:
    "driver (Mesa lavapipe) splits a subnormal as if its exponent were 0: fraction unnormalised, exponent 0, on Godot's side",
};

export const KNOWN_PROBE_DIFFERENCES = {
  'call-dFdx-float': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 0: Godot 80000000, transpilation 00000000',
  },
  'call-dFdx-vec3': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 3: Godot 80000000, transpilation 00000000',
  },
  'call-dFdxCoarse-float': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 0: Godot 80000000, transpilation 00000000',
  },
  'call-dFdxCoarse-vec3': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 3: Godot 80000000, transpilation 00000000',
  },
  'call-dFdxFine-float': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 0: Godot 80000000, transpilation 00000000',
  },
  'call-dFdxFine-vec3': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 3: Godot 80000000, transpilation 00000000',
  },
  'call-dFdy-float': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 10: Godot 00000000, transpilation ffc00000',
  },
  'call-dFdy-vec3': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 2: Godot 00000000, transpilation ffc00000',
  },
  'call-dFdyCoarse-float': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 10: Godot 00000000, transpilation ffc00000',
  },
  'call-dFdyCoarse-vec3': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 2: Godot 00000000, transpilation ffc00000',
  },
  'call-dFdyFine-float': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 10: Godot 00000000, transpilation ffc00000',
  },
  'call-dFdyFine-vec3': {
    ...ANGLE_DERIVATIVE,
    lanesOff: 3,
    first: 'lane 2: Godot 00000000, transpilation ffc00000',
  },
  'call-frexp-float-int-fraction': {
    ...UNNORMALISED_SUBNORMAL,
    lanesOff: 1,
    first: 'lane 12: Godot 3f0116c2, transpilation 3f0b6100',
  },
  'call-frexp-vec2-ivec2-fraction': {
    ...UNNORMALISED_SUBNORMAL,
    lanesOff: 2,
    first: 'lane 15: Godot 3f0116c2, transpilation 3f0b6100',
  },
  'call-frexp-vec3-ivec3-fraction': {
    ...UNNORMALISED_SUBNORMAL,
    lanesOff: 3,
    first: 'lane 8: Godot 3f0116c2, transpilation 3f0b6100',
  },
  'call-frexp-vec4-ivec4-fraction': {
    ...UNNORMALISED_SUBNORMAL,
    lanesOff: 4,
    first: 'lane 10: Godot 3f0116c2, transpilation 3f0b6100',
  },
  'call-frexp-float-int-exponent': {
    ...UNNORMALISED_SUBNORMAL,
    lanesOff: 1,
    first: 'lane 12: Godot 00000000, transpilation ffffff7c',
  },
  'call-frexp-vec2-ivec2-exponent': {
    ...UNNORMALISED_SUBNORMAL,
    lanesOff: 2,
    first: 'lane 15: Godot 00000000, transpilation ffffff7c',
  },
  'call-frexp-vec3-ivec3-exponent': {
    ...UNNORMALISED_SUBNORMAL,
    lanesOff: 3,
    first: 'lane 8: Godot 00000000, transpilation ffffff7c',
  },
  'call-frexp-vec4-ivec4-exponent': {
    ...UNNORMALISED_SUBNORMAL,
    lanesOff: 4,
    first: 'lane 10: Godot 00000000, transpilation ffffff7c',
  },
  'gpu-call-sinh-of-a-constant': {
    ...DRIVER_ROUNDED_CALL,
    folds: GODOT_DRIVER,
    lanesOff: 16,
    first: 'lane 0: Godot 3f8335f4, transpilation 3f8335f5',
  },
  'gpu-call-cosh-of-a-constant': {
    ...DRIVER_ROUNDED_CALL,
    folds: GODOT_DRIVER,
    lanesOff: 16,
    first: 'lane 0: Godot 3fa8f3c3, transpilation 3fa8f3c4',
  },
  'gpu-call-tanh-of-a-constant': {
    ...DRIVER_ROUNDED_CALL,
    folds: BROWSER_COMPILER,
    lanesOff: 16,
    first: 'lane 0: Godot 3f3b4538, transpilation 3f3b4539',
  },
  'gpu-call-asinh-of-a-constant': {
    ...DRIVER_ROUNDED_CALL,
    folds: BOTH_SIDES,
    lanesOff: 16,
    first: 'lane 0: Godot 3e4b756d, transpilation 3e4b756b',
  },
  'gpu-call-acosh-of-a-constant': {
    ...DRIVER_ROUNDED_CALL,
    folds: BROWSER_COMPILER,
    lanesOff: 16,
    first: 'lane 0: Godot 3fef8358, transpilation 3fef8359',
  },
  'gpu-call-atanh-of-a-constant': {
    ...DRIVER_ROUNDED_CALL,
    folds: BROWSER_COMPILER,
    lanesOff: 16,
    first: 'lane 0: Godot 3dad5bb6, transpilation 3dad5bb8',
  },
  'gpu-call-inverse-of-a-constant': {
    ...DRIVER_ROUNDED_CALL,
    folds: BROWSER_COMPILER,
    lanesOff: 64,
    first: 'lane 0: Godot 3e6e5305, transpilation 3e6e5304',
  },
  'gpu-call-atanh-outside-its-domain-of-a-constant': {
    ...DRIVER_EDGE_CALL,
    lanesOff: 16,
    first: 'lane 0: Godot 7fc00000, transpilation 00000000',
  },
  'gpu-call-acosh-outside-its-domain-of-a-constant': {
    ...DRIVER_EDGE_CALL,
    lanesOff: 16,
    first: 'lane 0: Godot 7fc00000, transpilation 00000000',
  },
  'gpu-call-inverse-of-a-singular-matrix-of-a-constant': {
    ...DRIVER_EDGE_CALL,
    lanesOff: 64,
    first: 'lane 0: Godot 7f800000, transpilation 00000000',
  },
  'gpu-call-cosh-near-the-float-range-of-a-constant': {
    ...DRIVER_EDGE_CALL,
    lanesOff: 16,
    first: 'lane 0: Godot 7f800000, transpilation 7f449aa0',
  },
  'gpu-call-mix-of-nan-of-a-constant': {
    ...DRIVER_NAN_MIX,
    lanesOff: 32,
    first: 'lane 0: Godot 7fc00000, transpilation 3f800000',
  },
  'call-min-vec2-float': {
    ...SCALAR_BOUND,
    lanesOff: 1,
    first: 'lane 34: Godot 80000000, transpilation 00000000',
  },
  'call-min-vec3-float': {
    ...SCALAR_BOUND,
    lanesOff: 3,
    first: 'lane 17: Godot 000116c2, transpilation 00000000',
  },
  'call-min-vec4-float': {
    ...SCALAR_BOUND,
    lanesOff: 3,
    first: 'lane 22: Godot 000116c2, transpilation 00000000',
  },
  'call-max-vec2-float': {
    ...SCALAR_BOUND,
    lanesOff: 1,
    first: 'lane 34: Godot 80000000, transpilation 00000000',
  },
  'call-max-vec3-float': {
    ...SCALAR_BOUND,
    lanesOff: 3,
    first: 'lane 17: Godot 000116c2, transpilation 00000000',
  },
  'call-max-vec4-float': {
    ...SCALAR_BOUND,
    lanesOff: 3,
    first: 'lane 22: Godot 000116c2, transpilation 00000000',
  },
  'call-clamp-vec2-float-float': {
    ...SCALAR_BOUND,
    lanesOff: 2,
    first: 'lane 34: Godot 80000000, transpilation 00000000',
  },
  'call-clamp-vec3-float-float': {
    ...SCALAR_BOUND,
    lanesOff: 2,
    first: 'lane 51: Godot 80000000, transpilation 00000000',
  },
  'call-clamp-vec4-float-float': {
    ...SCALAR_BOUND,
    lanesOff: 3,
    first: 'lane 68: Godot 80000000, transpilation 00000000',
  },
  'call-modf-float-float-whole': {
    ...UNREAD_MODF,
    lanesOff: 11,
    first: 'lane 1: Godot 00000000, transpilation 80000000',
  },
  'call-modf-vec2-vec2-whole': {
    ...UNREAD_MODF,
    lanesOff: 22,
    first: 'lane 1: Godot 00000000, transpilation c0000000',
  },
  'call-modf-vec3-vec3-whole': {
    ...UNREAD_MODF,
    lanesOff: 33,
    first: 'lane 1: Godot 00000000, transpilation c0000000',
  },
  'call-modf-vec4-vec4-whole': {
    ...UNREAD_MODF,
    lanesOff: 44,
    first: 'lane 1: Godot 00000000, transpilation c0000000',
  },
};
