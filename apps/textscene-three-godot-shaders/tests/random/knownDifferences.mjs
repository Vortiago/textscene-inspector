/**
 * The known differences from Godot, each a fixed case: a reduced program and its inputs, run on
 * every pass whatever the seed, the set size or the generator. The list only shrinks: a case
 * that equals Godot fails the run, so the pull request that fixes it removes it.
 */

import { inputRowsOfBits } from '../../../../scripts/godot-probes/probeShader.mjs';

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

/**
 * Each case by name, with its cause, the first lane that differs, its reduced program and its
 * inputs, the hex bits of each parameter's lanes row after row. `program` names the program of
 * the fixed set that shows the fault now: a program that differs and is no case's `program`
 * fails the run. A change to the set may leave a case with no program, and the case stays.
 */
export const KNOWN_DIFFERENCES = {
  'mat4-difference-product': {
    ...DRIVER_REWRITE,
    program: 'random-1847-107',
    lane: 'lane 32: Godot c31f9469, transpilation c31f9468',
    source:
      'mat4 probe(float a0, ivec3 a1) { return ((mat4(a0)) - a0) * mat4(vec4(a0, .98, a0, 11.744f), vec4(a0, .467, 61.588e+2, 13.97), vec4(a0), (vec4(3.910f, 56.755, a0, a0))) - .98; }',
    inputs: [
      '3f800000 7f800000 409cbe0e c58ce000 bf800000 7f61b1e6 46d63400 47839f00 c0bee219 41cdb021 455c4e66 3f99374c',
      '00000087 00000125 fffffd49 00000076 ffffff9e 00000000 000000de fffe8766 0000320a 000002dc 0000004b 00000000 0000002a fffffffe 00000001 ffff851b 00004be6 ffffea8d ffffedec fffffffd 00000008 fffffffb 00000000 00000e74 00000000 ffffffa6 00009871 ffff43a8 ffffff46 fffffff8 00000003 ffffffc5 fffffff3 fffffdaf ffffffa6 00000396',
    ],
  },
  'vec4-sum-swizzle-difference': {
    ...DRIVER_REWRITE,
    program: 'random-1847-136',
    lane: 'lane 0: Godot 488d8493, transpilation 488d8494',
    source:
      'vec2 probe(float a0) { return (vec4(a0, vec2(.463, 55.562e3), 0.679e+1) + vec4(a0)).ss - .463; }',
    inputs: [
      '459618cd 3f800000 c606179a c7c14400 c75c4e00 c5b9f800 464e4c00 c381a148 45609800 42869893 c44790a4 c7b66a80',
    ],
  },
  'mat2-double-sum': {
    ...DRIVER_REWRITE,
    program: 'random-1847-143',
    lane: 'lane 2: Godot 45eee9ef, transpilation 45eee9f1',
    source: 'mat2 probe(mat2 a0, uint a1, uint a2) { return a0 + a0 + 98.400; }',
    inputs: [
      '4291a1cb c5369ccd 422d3b64 c451d0a4 c191b021 c618d733 00000000 00000000 ff61b1e6 c43145c3 c7a7c580 4114594b 80000000 40f8f5c3 411f6f69 c6630800 47916200 c6f4ec00 c2a3999a 4791e100 c613219a 41f5c49c c2a535c3 c601ed9a 460bb19a c1b95604 3f000000 be0816f0 c2c5d70a 7f61b1e6 c765b600 c1dccac1 42366666 40f53c36 47449600 4249e148 7f800000 4108e9e2 c22d322d c08b4fdf c544119a c14cd917 47bca180 46d00600 4532a000 c20db127 c0300000 4606e733',
      '0000000d 00000000 ffffffa4 00000000 fffffb02 00000070 00000005 ffffffae fffffd60 0001e240 000020b6 00000c42',
      'fffe803c ffffe2f2 00000000 ffffffe1 0001584c 00000010 ffff83ca ffffe9e4 ffffdfeb ffff2eda fffffef7 00000007',
    ],
  },
  'vec4-sum-lane-difference': {
    ...DRIVER_REWRITE,
    program: 'random-1847-175',
    lane: 'lane 0: Godot 45bf5bf9, transpilation 45bf5bf7',
    source: 'float probe(float a0, bvec4 a1) { return (a0 + vec4(a0, 97.874e2, 50.459f, a0)).r - 75.440f; }',
    inputs: [
      'c0c3ce07 c29d9a1d c7a33c00 460fa666 c5fb30cd c462da3d c3d72a3d 00000000 ff800000 47f12065 40feb852 40bd97f6',
      '00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000000 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001',
    ],
  },
  'vec4-product-of-matrix-product': {
    ...DRIVER_REWRITE,
    program: 'random-1847-181',
    lane: 'lane 13: Godot c51f3e50, transpilation c51f3e4f',
    source:
      'vec4 probe(float a0, uint a1) { return vec4(a0, .530, vec2(.530)) * vec4(vec2(a0, a0), (vec2(6.650f, a0) * mat2(a0))).p; }',
    inputs: [
      '47a0c280 428e28f6 40db0a3d c0cc57a8 c61c00cd 40cd295f c5c75e66 439fc000 c0595cfb 409c0275 bfc3404f 47838200',
      '00000287 000100f5 fffffd12 00000001 0000035f 000056e4 00000005 00000000 00000006 0000018f 0000b727 fffffe18',
    ],
  },
  'scalar-plus-mat2-sum': {
    ...DRIVER_REWRITE,
    program: 'random-1847-217',
    lane: 'lane 2: Godot c362cf09, transpilation c362cf08',
    source: 'mat2 probe(mat2 a0) { return 56.407 + (a0 + a0); }',
    inputs: [
      '4459128f 3eb13405 c614659a c476c51f c79bb280 40a0d289 c0900ded ff800000 43c2b70a c3ae2ccd 4719c000 c768b700 425ec396 c7b1cb80 436ceb85 40e27e28 bf800000 45cc6666 47f12065 445f0eb8 c276872b c02dd495 7f800000 c7458600 c5c548cd c05d85f0 c16db22d c0e58ef3 46deb400 bf800000 000116c2 c5b17e66 bfc40831 c4144ae1 c5f47733 c6d52a00 000116c2 c29a49ba c28d6a7f 41b6f3b6 4457451f c000b439 4268449c c3ba399a 45d34d9a c5c62400 47af1700 40aef766',
    ],
  },
  'shift-right-by-minus-six': {
    ...UNDEFINED_SHIFT,
    program: 'random-1847-437',
    lane: 'lane 1: Godot ffffffff, transpilation fffff546',
    source: 'ivec4 probe(ivec4 a0, vec4 a1, uint a2) { return a0 >>= (-6); }',
    inputs: [
      '00000000 fffff546 01000001 00000020 00000000 fffff88a 00000000 00000020 000003c9 00011aea fffffff8 ffffff35 00001dba ffffffca fffffc86 000001fa ffffef34 00000005 00000003 0000027f 00000008 ffffffe0 ffffffcf ffff8a16 00009b76 00000001 fffffffe 00000039 00000001 00000000 00000020 fffffd37 ffffffac 0000237d ffffffbe ffffffc9 fffffffc 00001b4b fffffcfc fffffffd ffffffc7 0000a8a9 ffffffca fffffff7 fffffcfd 00000008 ffffeb06 0000005e',
      'c35ce666 4227cbc7 446627ae 400ebd3c c2433333 ff61b1e6 c7808800 c0aaa7f0 471fa800 c28dd917 4453b7ae 410d14e4 c5efce66 458d1800 3e166cf4 43f630a4 4466ac29 4083c01a c7621200 c299a7f0 424ccccd c4801000 00000000 c5ae3800 c39aa51f c744b500 3f800000 409dc01a 80000000 7f800000 c50cc4cd c1535c29 c0e4c49c c4138852 bf800000 c7b70800 c490b000 c42240a4 3fbd07c8 7f800000 7f800000 c4068ccd 42800189 424e8000 45f48666 33d6bf95 bf800000 33d6bf95',
      '00000000 0000000a 01000001 ffffffea 00000000 ffffff6b ffffffb6 00000009 00000261 0000000e 00000000 00000041',
    ],
  },
  'shift-left-by-not-eighteen': {
    ...UNDEFINED_SHIFT,
    program: 'random-1847-622',
    lane: 'lane 0: Godot 00000000, transpilation ffffffac',
    source: 'int probe(int a0, bvec4 a1) { return a0 << ~18; }',
    inputs: [
      'fffffcc6 fffffdfe ffff15fa 000001d2 0000002d 00000000 ffffffe9 ffffffb2 00000000 0000005b 00000000 fffffffe',
      '00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000000 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000001 00000000 00000001',
    ],
  },
  'swizzle-product': {
    ...DRIVER_REWRITE,
    lane: 'lane 9: Godot 2b488d09, transpilation 2b488d0a',
    source:
      'vec3 probe(float a0, float a1) { return (vec4(41.779e+1, 2.450e+3, 96.675, a1) * vec3(.917, 55.526, a1).yyyz).aar * vec4(71.250f).aar; }',
    inputs: [
      'c2353021 c402b51f c01c4ea5 4b800000 411967a1 7f800000 441f7333 47f12065 c7601600 c4bcd99a 443703d7 42bd9168',
      '41219168 45c79333 c209c6a8 33d6bf95 c56c84cd 4507a800 45a1259a 45a138cd 420ecfdf 3eaaaaab 47a51480 406a3d71',
    ],
  },
  'product-in-constructor': {
    ...DRIVER_REWRITE,
    lane: 'lane 14: Godot c939aa70, transpilation c939aa71',
    source:
      'vec4 probe(vec2 a0, vec2 a1) { return vec4(.332, .332, vec3(19.549f, 94.347, 99.476).ptsp.bg * ((a1 * a0).rr)); }',
    inputs: [
      '80000000 c42778f6 c273fae1 7f61b1e6 ff61b1e6 ff800000 c298e4dd c547a666 42f48f5c 40dea7f0 c1f55a1d c5f1eb33 c61c0066 409c5a1d c2a4451f 4261e148 c019f6fd 472c0700 47a12800 c1174c98 80000000 41b2ced9 46e23e00 c6ad9600',
      '45b5e400 3e3a92a3 c7c13e00 43d57333 c34975c3 33d6bf95 43fe6f5c c2a50ac1 7f800000 414a4189 c7932400 476c5900 c25453f8 c5e8de66 7f800000 47804100 40472fec 426f9db2 bf800000 45accccd c6ff1400 c609c533 c21bb021 c4544333',
    ],
  },
  'difference-chain': {
    ...DRIVER_REWRITE,
    lane: 'lane 23: Godot c7939fbe, transpilation c7939fbd',
    source: 'vec4 probe(float a0, vec3 a1, float a2) { return a0 - a2 - vec4(.875, a2, a0, 76.391e+3); }',
    inputs: [
      '444f251f 44021ccd 40bb34d7 46119e00 451e54cd c009b3d0 3fb9cac1 c70ddd00 c7ac0080 c6a0b000 42066666 c16bc6a8',
      '40966f69 c709a100 bf72de01 3f8dd2f2 ff61b1e6 c0a7ef9e 40aad42c c24e8831 c27f9eb8 43e670a4 46afea00 411badac bf800000 c0323d71 7fc00000 46891200 c5eb8000 c7947100 45246b33 3f800000 418e020c 42a31a1d 3f5bc01a 40e9013b 434b8ccd 3f800000 40ce52bd 40a6fb7f 3f000000 4794a280 40f3205c 4105e282 c0300000 bd058794 c4d80000 c073e76d',
      '47f12065 3fe1b717 41093a2a 44438666 c213676d c44a6ae1 bf800000 40c56fd2 46065b9a 41f5b22d c5d30e66 41a73333',
    ],
  },
  'quotient-by-cancelling-sum': {
    ...DRIVER_REWRITE,
    lane: 'lane 0: Godot 7f800000, transpilation 00000000',
    source:
      'vec4 probe(vec3 a0, float a1, vec3 a2) { return vec4(a1, a1, vec2(43.56f)) / (vec4(a0 + -a0, a1)); }',
    inputs: [
      '45b08b33 42a37a5e 446c6000 4583e400 33d6bf95 c43603d7 c778ca00 c433247b 3edb645a 42ba3cee c55aa800 c4cdc333 4b800000 c4713ccd 40161ff3 4113a858 c63a2800 458bf800 c08f07c8 46fa1600 be9a0275 000116c2 3f000000 45984c00 c2999604 3e9b645a 4213ef9e c73ea500 47583000 c3c64000 c0b67ae1 80000000 c760b400 c5d33666 47f12065 421bba5e',
      '458c5400 c2182e14 400c902e 3f56a162 7fc00000 47f12065 c4391333 3f000000 c6c9ea00 40e80831 c5ba7b33 3f38793e',
      'bf800000 ff800000 423bad0e c5b44a66 3eaaaaab c79f8680 410fd6a1 47c07f00 46975800 c5fb9c00 3eaaaaab c10e4189 423d2c08 42a771aa c73f7a00 41ba6666 c60d6a00 c0f94c98 428d7cee c595c666 410d154d 44f0a000 4b800000 7fc00000 47aff900 40bbc433 40e95b57 4612ac66 410dc3ca 4b800000 430c7852 4706fb00 43ce87ae 45db1b33 c1e85810 3eaaaaab',
    ],
  },
  'negated-swizzle-difference': {
    ...DRIVER_REWRITE,
    lane: 'lane 1: Godot c07a4a8c, transpilation c07a4a9b',
    source:
      'vec2 probe(float a0) { return (-vec4(a0, 94.450, a0, 95.584e+1)).y - ((vec2(a0)) + (vec2(73.200, .452)) - 94.450); }',
    inputs: [
      '405d5cfb c4497e14 c6048e00 c58e399a 4700a100 4216c5a2 c4693000 3f800000 47b81280 c457d1ec c56dfb33 c5cdc400',
    ],
  },
};

/** The name of a case's probe, beside the programs of the fixed set in Godot's record. */
const caseName = (name) => `known-${name}`;

/** Each case as a probe that `pnpm godot:probes` records and the page compares. */
export const KNOWN_DIFFERENCE_CASES = Object.entries(KNOWN_DIFFERENCES).map(([name, known]) => ({
  name: caseName(name),
  difference: name,
  source: known.source,
  inputs: inputRowsOfBits(
    known.source,
    known.inputs.map((lanes) => lanes.split(' '))
  ),
}));

/** The random probes Godot's record holds: the programs of a set, then every fixed case. */
export const recordedRandomProbes = (programs) => [...programs, ...KNOWN_DIFFERENCE_CASES];

/** The programs of the fixed set that a case names as showing its fault now. */
export const KNOWN_PROGRAMS = new Set(
  Object.values(KNOWN_DIFFERENCES)
    .map((known) => known.program)
    .filter((program) => program !== undefined)
);

/**
 * Records that went stale on one CI runner only, each with the run that showed it. Godot's bits
 * changed and the transpilation was not compared, so these are no fixed cases: the "Shader
 * package" job prints the CPU and the driver on every run and keeps both value sets on a stale
 * record, and an entry stays until a second driver or a second runner answers its cause.
 */
export const RUNNER_DEPENDENT_RESULTS = [
  {
    probes: ['mul-mat3-mat3', 'random-1847-186'],
    run: 'https://github.com/Vortiago/textscene-inspector/actions/runs/43521363803/job/132217524982',
    seen: 'Godot gave other bits on one runner (3.5 minutes against about 1). The rerun on another runner and 3 local runs equal the record.',
    owner: '#1823, decision with Atle',
  },
];
