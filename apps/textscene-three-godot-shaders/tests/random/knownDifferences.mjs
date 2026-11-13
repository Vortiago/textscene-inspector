/**
 * The programs of the fixed-seed set that differ from Godot now, each with the issue that owns
 * the fault. The list only shrinks: a program that differs and is not here fails the run, and a
 * program here that equals Godot fails it too, so the pull request that fixes it removes it.
 */

/**
 * Mesa's compiler on lavapipe treats float operations as inexact: it reorders them, fuses
 * `x + x + c` into one multiply-add and writes `x + -x` as 0. Godot's SPIR-V and the browser's
 * differ in shape, so a rewrite fires on one side only: `a + a + 98.4` is IEEE in Godot's `mat2`
 * and fused in its `float`.
 */
const DRIVER_REWRITE = {
  owner: '#1823',
  cause: 'driver rewrite (Mesa lavapipe) on one side only, decision with Atle',
};

/**
 * GLSL leaves a shift by a negative count, or by 32 and more, undefined. The two sides reach the
 * driver through different front ends, and each gives its own answer.
 */
const UNDEFINED_SHIFT = {
  owner: '#1823',
  cause: 'shift count out of range at runtime, which GLSL leaves undefined: the drivers differ',
};

/** Each program by name, with its cause, the first lane that differs and its reduced program. */
export const KNOWN_DIFFERENCES = {
  'random-1847-107': {
    ...DRIVER_REWRITE,
    lane: 'lane 32: Godot c31f9469, transpilation c31f9468',
    reduced:
      'mat4 probe(float a0, ivec3 a1) { return ((mat4(a0)) - a0) * mat4(vec4(a0, .98, a0, 11.744f), vec4(a0, .467, 61.588e+2, 13.97), vec4(a0), (vec4(3.910f, 56.755, a0, a0))) - .98; }',
  },
  'random-1847-136': {
    ...DRIVER_REWRITE,
    lane: 'lane 0: Godot 488d8493, transpilation 488d8494',
    reduced:
      'vec2 probe(float a0) { return (vec4(a0, vec2(.463, 55.562e3), 0.679e+1) + vec4(a0)).ss - .463; }',
  },
  'random-1847-143': {
    ...DRIVER_REWRITE,
    lane: 'lane 2: Godot 45eee9ef, transpilation 45eee9f1',
    reduced: 'mat2 probe(mat2 a0, uint a1, uint a2) { return a0 + a0 + 98.400; }',
  },
  'random-1847-175': {
    ...DRIVER_REWRITE,
    lane: 'lane 0: Godot 45bf5bf9, transpilation 45bf5bf7',
    reduced: 'float probe(float a0, bvec4 a1) { return (a0 + vec4(a0, 97.874e2, 50.459f, a0)).r - 75.440f; }',
  },
  'random-1847-181': {
    ...DRIVER_REWRITE,
    lane: 'lane 13: Godot c51f3e50, transpilation c51f3e4f',
    reduced:
      'vec4 probe(float a0, uint a1) { return vec4(a0, .530, vec2(.530)) * vec4(vec2(a0, a0), (vec2(6.650f, a0) * mat2(a0))).p; }',
  },
  'random-1847-217': {
    ...DRIVER_REWRITE,
    lane: 'lane 2: Godot c362cf09, transpilation c362cf08',
    reduced: 'mat2 probe(mat2 a0) { return 56.407 + (a0 + a0); }',
  },
  'random-1847-437': {
    ...UNDEFINED_SHIFT,
    lane: 'lane 1: Godot ffffffff, transpilation fffff546',
    reduced: 'ivec4 probe(ivec4 a0, vec4 a1, uint a2) { return a0 >>= (-6); }',
  },
  'random-1847-622': {
    ...UNDEFINED_SHIFT,
    lane: 'lane 0: Godot 00000000, transpilation ffffffac',
    reduced: 'int probe(int a0, bvec4 a1) { return a0 << ~18; }',
  },
};
