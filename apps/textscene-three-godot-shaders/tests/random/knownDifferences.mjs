/**
 * The programs of the fixed-seed set that differ from Godot now, each with the issue that owns
 * the fault. The list only shrinks: a program that differs and is not here fails the run, and a
 * program here that equals Godot fails it too, so the pull request that fixes it removes it.
 */

/**
 * Mesa's compiler on lavapipe treats float operations as inexact: it reorders them and writes
 * `x + -x` as 0. Godot's SPIR-V and the browser's differ in shape, so a rewrite fires on one
 * side only. Each scalar form of these programs is bit-equal: only the vector forms differ.
 */
const DRIVER_REWRITE = {
  owner: '#1823',
  cause:
    'driver rewrite (Mesa lavapipe), decision with Atle: the scalar forms are bit-equal, only the vector forms differ',
};

/** Each program by name, with its cause, the first lane that differs and its reduced program. */
export const KNOWN_DIFFERENCES = {
  'random-1847-32': {
    ...DRIVER_REWRITE,
    lane: 'lane 3: Godot cfec57a9, transpilation cfec57a8',
    reduced:
      'vec3 probe(float a0, float a1) { return (vec4(41.779e+1, 2.450e+3, 96.675, a1) * vec3(.917, 55.526, a1).yyyz).aar * vec4(71.250f).aar; }',
  },
  'random-1847-55': {
    ...DRIVER_REWRITE,
    lane: 'lane 14: Godot c939aa70, transpilation c939aa71',
    reduced:
      'vec4 probe(vec2 a0, vec2 a1) { return vec4(.332, .332, vec3(19.549f, 94.347, 99.476).ptsp.bg * ((a1 * a0).rr)); }',
  },
  'random-1847-87': {
    ...DRIVER_REWRITE,
    lane: 'lane 0: Godot c2b6397a, transpilation c2b6397b',
    reduced: 'vec4 probe(float a0, vec3 a1, float a2) { return a0 - a2 - vec4(.875, a2, a0, 76.391e+3); }',
  },
  'random-1847-106': {
    ...DRIVER_REWRITE,
    lane: 'lane 1: Godot 7f800000, transpilation 00000000',
    reduced:
      'vec4 probe(vec3 a0, float a1, vec3 a2) { return vec4(a1, a1, vec2(43.56f)) / (vec4(a0 + -a0, a1)); }',
  },
  'random-1847-120': {
    ...DRIVER_REWRITE,
    lane: 'lane 1: Godot 3ffe8dff, transpilation 3ffe8e1f',
    reduced:
      'vec2 probe(float a0) { return (-vec4(a0, 94.450, a0, 95.584e+1)).y - ((vec2(a0)) + (vec2(73.200, .452)) - 94.450); }',
  },
};
