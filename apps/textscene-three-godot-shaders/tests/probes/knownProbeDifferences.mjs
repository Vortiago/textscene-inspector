/**
 * The probes that differ from Godot by a known cause, each with the count of lanes off and the
 * first. A listed probe passes only while it differs exactly so, and fails once it equals Godot,
 * so the change that fixes it removes its entry (`coverageFailures` in integration/compare.mjs).
 */

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
const UNREAD_MODF = {
  owner: '#1826',
  cause: "driver (Mesa lavapipe) drops the out store of a modf whose value nothing reads, on Godot's side",
};

export const KNOWN_PROBE_DIFFERENCES = {
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
