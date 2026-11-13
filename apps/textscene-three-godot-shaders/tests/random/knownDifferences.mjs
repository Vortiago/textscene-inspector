/**
 * The programs of the fixed-seed set that differ from Godot now, each with the issue that owns
 * the fault. The list only shrinks: a program that differs and is not here fails the run, and a
 * program here that equals Godot fails it too, so the pull request that fixes it removes it.
 */

const DOUBLE_NEGATION = {
  owner: '#1823',
  cause: 'Godot writes `-(-a)` as `-a`: its compiler drops a minus before a minus (shader_compiler.cpp:1141)',
};

const CONSTANT_FOLDING = {
  owner: '#1823',
  cause:
    'glslang folds arithmetic of constants in double precision and rounds once, the transpiler in 32-bit floats',
};

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
  'random-1847-2': {
    ...DOUBLE_NEGATION,
    lane: 'lane 0: Godot 473d7043, translation c73d7043',
    reduced: 'vec2 probe(vec3 a0, vec4 a1, float a2) { return -(-vec2(a2, .499)); }',
  },
  'random-1847-32': {
    ...DRIVER_REWRITE,
    lane: 'lane 3: Godot cfec57a9, translation cfec57a8',
    reduced:
      'vec3 probe(float a0, float a1) { return (vec4(41.779e+1, 2.450e+3, 96.675, a1) * vec3(.917, 55.526, a1).yyyz).aar * vec4(71.250f).aar; }',
  },
  'random-1847-55': {
    ...DRIVER_REWRITE,
    lane: 'lane 14: Godot c939aa70, translation c939aa71',
    reduced:
      'vec4 probe(vec2 a0, vec2 a1) { return vec4(.332, .332, vec3(19.549f, 94.347, 99.476).ptsp.bg * ((a1 * a0).rr)); }',
  },
  'random-1847-58': {
    ...DOUBLE_NEGATION,
    lane: 'lane 0: Godot 41eb8092, translation c1eb8092',
    reduced: 'vec4 probe(vec4 a0, vec3 a1) { return vec4(-(-a1.sp), vec2(20.26f)); }',
  },
  'random-1847-61': {
    ...CONSTANT_FOLDING,
    lane: 'lane 0: Godot 475555b2, translation 475555b1',
    reduced: 'float probe(vec4 a0) { return ((68.452 * vec3(79.708e1) + ((vec2(51.97f)).t)).zx).t; }',
  },
  'random-1847-78': {
    ...CONSTANT_FOLDING,
    lane: 'lane 0: Godot 3f274db7, translation 3f274db8',
    reduced: 'vec4 probe(float a0) { return vec3(58.656).bggr + 74.377f; }',
  },
  'random-1847-87': {
    ...DRIVER_REWRITE,
    lane: 'lane 0: Godot c2b6397a, translation c2b6397b',
    reduced: 'vec4 probe(float a0, vec3 a1, float a2) { return a0 - a2 - vec4(.875, a2, a0, 76.391e+3); }',
  },
  'random-1847-106': {
    ...DRIVER_REWRITE,
    lane: 'lane 1: Godot 7f800000, translation 00000000',
    reduced:
      'vec4 probe(vec3 a0, float a1, vec3 a2) { return vec4(a1, a1, vec2(43.56f)) / (vec4(a0 + -a0, a1)); }',
  },
  'random-1847-120': {
    ...DRIVER_REWRITE,
    lane: 'lane 1: Godot 3ffe8dff, translation 3ffe8e1f',
    reduced:
      'vec2 probe(float a0) { return (-vec4(a0, 94.450, a0, 95.584e+1)).y - ((vec2(a0)) + (vec2(73.200, .452)) - 94.450); }',
  },
  'random-1847-143': {
    ...CONSTANT_FOLDING,
    lane: 'lane 0: Godot 44c4d666, translation 44c4d667',
    reduced:
      'float probe(float a0) { return (vec3(83.626e-3, 51.335, 4.699f) * (28.107f - vec3(1.341e2)) * (57.445e-2 - vec3(82.749e-2))).s; }',
  },
  'random-1847-155': {
    ...DOUBLE_NEGATION,
    lane: 'lane 0: Godot c6ebca66, translation c6ebad9a',
    reduced: 'vec3 probe(vec3 a0, vec2 a1, float a2) { return (-(-a2)) + a0; }',
  },
  'random-1847-179': {
    ...CONSTANT_FOLDING,
    lane: 'lane 6: Godot c3a9cb22, translation c3a9cb23',
    reduced: 'vec2 probe(vec2 a0, float a1) { return ((71.543f + 54.854f) / a0.rgg).ts; }',
  },
  'random-1847-204': {
    ...CONSTANT_FOLDING,
    lane: 'lane 0: Godot 398e65e3, translation 398e65e2',
    reduced: 'vec4 probe(vec2 a0) { return (33.135 - .886) / vec4(69.143f, 32.672f, 63.833, .959); }',
  },
};
