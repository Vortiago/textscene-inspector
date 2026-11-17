import {
  BOTH_SIDES,
  BROWSER_COMPILER,
  DRIVER_EDGE_CALL,
  DRIVER_NAN_MIX,
  DRIVER_ROUNDED_CALL,
  GODOT_DRIVER,
} from '../driverFolds.mjs';

/** The drivers' front ends differ: Godot keeps the sign of a zero or subnormal, the browser gives +0. */
const SCALAR_BOUND = {
  owner: '#1826',
  cause: 'driver front ends: a float bound of a vector gives +0 for -0 and a subnormal on the browser side',
};

/** Lavapipe drops the out store of a `modf` whose value nothing reads (`GlslangToSpv.cpp:8767`). */
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

// Measured: Godot's ldexp(3e38, e) equals ours at -252, -251, -250 and gives 0 at -253.
const SPLIT_LDEXP = {
  owner: '#1827',
  cause:
    "driver (Mesa lavapipe) gives 0 for ldexp(3e38, -253), on Godot's side: inferred, not read from Mesa, as a split into exponent halves that flushes 2^-127",
};

/** A probe's derivatives are 0. Inferred, not read from Mesa: a fast log2 of the squared length, halved. */
const ZERO_DERIVATIVE_LOD = {
  owner: '#1829',
  cause:
    "driver (Mesa lavapipe) gives -63.5 for the level of detail of a zero derivative, where log2(0) is -inf, on Godot's side",
};

/** Vulkan leaves anisotropic filtering to the driver. Inferred, not read from Mesa: weighted linear taps. */
const ANISOTROPIC_FOOTPRINT = {
  owner: '#1829',
  cause:
    "driver (Mesa lavapipe) filters an anisotropic sampler with weighted linear taps, also for a nearest filter, on Godot's side",
};

export const KNOWN_PROBE_DIFFERENCES = {
  'texture-2d-filter_nearest_mipmap_anisotropic': {
    ...ANISOTROPIC_FOOTPRINT,
    lanesOff: 11,
    first: 'lane 12: Godot 3d109091, transpilation 3d888889',
  },
  'texture-2d-filter_linear_mipmap_anisotropic': {
    ...ANISOTROPIC_FOOTPRINT,
    lanesOff: 5,
    first: 'lane 14: Godot 3d20a0a2, transpilation 3d30b0b1',
  },
  'texture-function-textureQueryLod-sampler2D-vec2': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-isampler2D-vec2': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-usampler2D-vec2': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-sampler2DArray-vec2': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-isampler2DArray-vec2': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-usampler2DArray-vec2': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-sampler3D-vec3': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-isampler3D-vec3': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-usampler3D-vec3': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
  'texture-function-textureQueryLod-samplerCube-vec3': {
    ...ZERO_DERIVATIVE_LOD,
    lanesOff: 3,
    first: 'lane 1: Godot c27e0000, transpilation ff800000',
  },
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
  'call-ldexp-float-int-range': {
    ...SPLIT_LDEXP,
    lanesOff: 1,
    first: 'lane 35: Godot 00000000, transpilation 00e1b1e6',
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
