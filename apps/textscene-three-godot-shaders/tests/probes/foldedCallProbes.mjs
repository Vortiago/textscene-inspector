/**
 * Built-in calls of constants alone, which Godot's GLSL compiler, glslang, folds on the CPU in
 * double precision and rounds once (`Constant.cpp`). Each value is one where that fold and the
 * GPU's float arithmetic give different bits, or an edge where glslang's formula is its own:
 * `round` of a half, `sign` of NaN, `lessThanEqual` of NaN. The page reads the constant written.
 */

import { probeOf } from './languageProbes.mjs';

/** Each case: its word, the rows it calls, its return type and the call. */
const CASES = [
  ['radians', ['radians(float)'], 'float', 'radians(57.2958)'],
  ['degrees', ['degrees(float)'], 'float', 'degrees(1.2345)'],
  ['sin-cos', ['sin(float)', 'cos(float)'], 'vec2', 'vec2(sin(46.0), cos(46.0))'],
  ['tan', ['tan(vec2)'], 'vec2', 'tan(vec2(1.5, -0.7))'],
  [
    'inverse-trigonometry',
    ['asin(float)', 'acos(float)', 'atan(float)'],
    'vec3',
    'vec3(asin(0.3), acos(0.3), atan(7.5))',
  ],
  ['atan-of-two', ['atan(vec2,vec2)'], 'vec2', 'atan(vec2(1.0, -1.0), vec2(-2.0, 0.5))'],
  ['pow', ['pow(vec2,vec2)'], 'vec2', 'pow(vec2(1.7, 9.1), vec2(2.3, 0.37))'],
  ['exp-log', ['exp(float)', 'log(float)'], 'vec2', 'vec2(exp(3.3), log(7.7))'],
  ['exp2-log2', ['exp2(float)', 'log2(float)'], 'vec2', 'vec2(exp2(3.3), log2(7.7))'],
  ['sqrt-inversesqrt', ['sqrt(float)', 'inversesqrt(float)'], 'vec2', 'vec2(sqrt(2.0), inversesqrt(3.0))'],
  ['abs', ['abs(vec2)', 'abs(ivec2)'], 'vec3', 'vec3(abs(vec2(-0.0, -1.25)), float(abs(ivec2(-5, 7)).x))'],
  ['sign', ['sign(vec4)'], 'vec4', 'sign(vec4(-0.0, sqrt(-1.0), -3.5, 2.0))'],
  ['sign-int', ['sign(ivec2)'], 'ivec2', 'sign(ivec2(-7, 0))'],
  [
    'floor-ceil-fract-trunc',
    ['floor(float)', 'ceil(float)', 'fract(float)', 'trunc(float)'],
    'vec4',
    'vec4(floor(-1.5), ceil(-1.5), fract(-0.1), trunc(-0.5))',
  ],
  ['round', ['round(vec4)'], 'vec4', 'round(vec4(-2.5, 2.5, 0.5, -0.5))'],
  ['round-even', ['roundEven(vec4)'], 'vec4', 'roundEven(vec4(2.5, 3.5, -2.5, -0.5))'],
  ['mod', ['mod(vec2,float)'], 'vec2', 'mod(vec2(-1.1, 7.3), 3.0)'],
  [
    'min-max-of-nan',
    ['min(float,float)', 'max(float,float)'],
    'vec3',
    'vec3(min(sqrt(-1.0), 1.0), max(1.0, sqrt(-1.0)), max(0.1, 0.2))',
  ],
  ['clamp', ['clamp(vec3,float,float)'], 'vec3', 'clamp(vec3(-1.0, 0.3, 2.0), 0.1, 0.9)'],
  ['clamp-int', ['clamp(ivec2,int,int)'], 'ivec2', 'clamp(ivec2(-9, 9), 0, 4)'],
  ['min-uint', ['min(uvec2,uint)'], 'uvec2', 'min(uvec2(3u, 9u), 5u)'],
  ['mix', ['mix(float,float,float)'], 'float', 'mix(0.1, 0.7, 0.3)'],
  ['mix-bool', ['mix(vec2,vec2,bvec2)'], 'vec2', 'mix(vec2(1.5), vec2(2.5), bvec2(true, false))'],
  ['step', ['step(float,vec2)'], 'vec2', 'step(0.5, vec2(0.2, 0.7))'],
  ['smoothstep', ['smoothstep(float,float,vec2)'], 'vec2', 'smoothstep(0.1, 0.9, vec2(0.33, 0.77))'],
  ['isnan-isinf', ['isnan(float)', 'isinf(float)'], 'bvec2', 'bvec2(isnan(sqrt(-1.0)), isinf(1.0 / 0.0))'],
  ['length', ['length(vec3)'], 'float', 'length(vec3(0.1, 0.2, 0.3))'],
  ['distance', ['distance(vec2,vec2)'], 'float', 'distance(vec2(0.1, 0.2), vec2(0.7, 0.9))'],
  ['dot', ['dot(vec3,vec3)'], 'float', 'dot(vec3(0.1, 0.2, 0.3), vec3(0.4, 0.5, 0.6))'],
  ['cross', ['cross(vec3,vec3)'], 'vec3', 'cross(vec3(0.1, 0.2, 0.3), vec3(0.4, 0.5, 0.6))'],
  ['normalize', ['normalize(vec3)'], 'vec3', 'normalize(vec3(0.1, 0.2, 0.3))'],
  [
    'faceforward',
    ['faceforward(vec3,vec3,vec3)'],
    'vec3',
    'faceforward(vec3(0.1, 0.2, 0.3), vec3(0.4, -0.5, 0.6), vec3(0.7, 0.8, 0.9))',
  ],
  ['reflect', ['reflect(vec3,vec3)'], 'vec3', 'reflect(vec3(0.1, -0.7, 0.2), vec3(0.3, 0.9, 0.1))'],
  [
    'refract',
    ['refract(vec3,vec3,float)'],
    'vec3',
    'refract(vec3(0.6, -0.8, 0.0), vec3(0.0, 1.0, 0.0), 0.66)',
  ],
  [
    'refract-past-the-critical-angle',
    ['refract(vec2,vec2,float)'],
    'vec2',
    'refract(vec2(0.8, -0.6), vec2(0.0, 1.0), 2.0)',
  ],
  [
    'outer-product',
    ['outerProduct(vec3,vec3)'],
    'mat3',
    'outerProduct(vec3(0.1, 0.2, 0.3), vec3(0.7, 0.9, 1.1))',
  ],
  [
    'less-than',
    ['lessThan(vec2,vec2)', 'greaterThan(ivec2,ivec2)'],
    'bvec4',
    'bvec4(lessThan(vec2(0.1, 0.3), vec2(0.2)), greaterThan(ivec2(1, 2), ivec2(2, 1)))',
  ],
  [
    'less-than-equal-of-nan',
    ['lessThanEqual(vec2,vec2)', 'greaterThanEqual(vec2,vec2)'],
    'bvec4',
    'bvec4(lessThanEqual(vec2(sqrt(-1.0), 0.5), vec2(1.0)), greaterThanEqual(vec2(sqrt(-1.0), 0.5), vec2(1.0)))',
  ],
  [
    'equal',
    ['equal(vec2,vec2)', 'notEqual(uvec2,uvec2)'],
    'bvec4',
    'bvec4(equal(vec2(0.1 + 0.2, 0.5), vec2(0.3, 0.5)), notEqual(uvec2(1u, 2u), uvec2(1u, 3u)))',
  ],
  [
    'any-all-not',
    ['any(bvec2)', 'all(bvec2)', 'not(bvec2)'],
    'bvec4',
    'bvec4(any(bvec2(false, true)), all(bvec2(false, true)), not(bvec2(false, true)))',
  ],
  ['call-of-calls', ['sin(float)', 'cos(float)', 'exp(float)'], 'float', 'sin(cos(0.5)) * exp(0.25)'],
  [
    'min-max-int',
    ['min(ivec2,int)', 'max(ivec2,ivec2)'],
    'ivec4',
    'ivec4(min(ivec2(-3, 9), 4), max(ivec2(-7, 3), ivec2(2)))',
  ],
  ['max-uint', ['max(uvec2,uvec2)'], 'uvec2', 'max(uvec2(3u, 9u), uvec2(5u))'],
  ['clamp-uint', ['clamp(uvec2,uint,uint)'], 'uvec2', 'clamp(uvec2(1u, 9u), 2u, 5u)'],
  [
    'compare-int-uint',
    ['lessThanEqual(uvec2,uvec2)', 'greaterThanEqual(ivec2,ivec2)'],
    'bvec4',
    'bvec4(lessThanEqual(uvec2(1u, 3u), uvec2(2u)), greaterThanEqual(ivec2(-1, 2), ivec2(0)))',
  ],
  [
    'equal-int-bool',
    ['equal(ivec2,ivec2)', 'notEqual(bvec2,bvec2)'],
    'bvec4',
    'bvec4(equal(ivec2(-1, 2), ivec2(-1, 3)), notEqual(bvec2(true, false), bvec2(true, true)))',
  ],
  [
    'vector-bounds',
    ['clamp(vec2,vec2,vec2)', 'mix(vec2,vec2,vec2)'],
    'vec4',
    'vec4(clamp(vec2(-1.0, 2.0), vec2(0.1, 0.2), vec2(0.8, 0.9)), mix(vec2(0.1, 0.2), vec2(0.7, 0.9), vec2(0.3, 0.6)))',
  ],
  [
    'vector-steps',
    ['step(vec2,vec2)', 'smoothstep(vec2,vec2,vec2)'],
    'vec4',
    'vec4(step(vec2(0.5, 0.1), vec2(0.2, 0.7)), smoothstep(vec2(0.1, 0.2), vec2(0.9, 0.8), vec2(0.33, 0.77)))',
  ],
  [
    'vector-mod-max-pow',
    ['mod(vec2,vec2)', 'max(vec2,vec2)', 'pow(vec2,vec2)'],
    'vec4',
    'vec4(mod(vec2(-1.1, 7.3), vec2(3.0, 0.7)), max(vec2(0.1, 0.9), vec2(0.2, 0.3)) * pow(vec2(1.3), vec2(0.7, 2.9)))',
  ],
];

/**
 * Calls glslang leaves to the GPU, each of a constant and of the same value through a parameter,
 * which no compiler can fold: on the input 0, `a + 0.899` is `0.899`. The parameter probe gives
 * the GPU's value on both sides, so the side whose constant probe differs from it folds the call.
 */
const LEFT_TO_THE_GPU = [
  ['sinh', ['sinh(float)'], 'float', 'sinh(0.899)', 'sinh(a + 0.899)'],
  ['cosh', ['cosh(float)'], 'float', 'cosh(0.78)', 'cosh(a + 0.78)'],
  ['tanh', ['tanh(float)'], 'float', 'tanh(0.932)', 'tanh(a + 0.932)'],
  ['asinh', ['asinh(float)'], 'float', 'asinh(0.2)', 'asinh(a + 0.2)'],
  ['acosh', ['acosh(float)'], 'float', 'acosh(3.325)', 'acosh(a + 3.325)'],
  ['atanh', ['atanh(float)'], 'float', 'atanh(0.084446)', 'atanh(a + 0.084446)'],
  ['determinant', ['determinant(mat2)'], 'float', 'determinant(MATRIX)', 'determinant(PARAMETER_MATRIX)'],
  ['inverse', ['inverse(mat2)'], 'mat2', 'inverse(MATRIX)', 'inverse(PARAMETER_MATRIX)'],
  [
    'matrix-comp-mult',
    ['matrixCompMult(mat2,mat2)'],
    'mat2',
    'matrixCompMult(MATRIX, mat2(vec2(0.7, 0.3), vec2(1.9, -0.6)))',
    'matrixCompMult(PARAMETER_MATRIX, mat2(vec2(0.7, 0.3), vec2(1.9, -0.6)))',
  ],
  ['transpose', ['transpose(mat2)'], 'mat2', 'transpose(MATRIX)', 'transpose(PARAMETER_MATRIX)'],
  ['atanh-outside-its-domain', ['atanh(float)'], 'float', 'atanh(92.167)', 'atanh(a + 92.167)'],
  ['acosh-outside-its-domain', ['acosh(float)'], 'float', 'acosh(0.866)', 'acosh(a + 0.866)'],
  [
    'inverse-of-a-singular-matrix',
    ['inverse(mat2)'],
    'mat2',
    'inverse(SINGULAR)',
    'inverse(PARAMETER_SINGULAR)',
  ],
  ['cosh-near-the-float-range', ['cosh(float)'], 'float', 'cosh(89.152)', 'cosh(a + 89.152)'],
  [
    'mix-of-nan',
    ['mix(vec2,vec2,float)', 'acosh(vec2)', 'atan(vec2)'],
    'vec2',
    'mix(vec2(acosh(atan(1.0))), vec2(1.0), 1.0)',
    'mix(vec2(acosh(atan(a + 1.0))), vec2(1.0), 1.0)',
  ],
];

/** The matrices of the matrix calls, each of constants and through the parameter. */
const MATRICES = {
  PARAMETER_MATRIX: 'mat2(vec2(a + 0.33, 1.7), vec2(-2.1, 0.9))',
  MATRIX: 'mat2(vec2(0.33, 1.7), vec2(-2.1, 0.9))',
  PARAMETER_SINGULAR: 'mat2(vec2(a + 1.0, 2.0), vec2(2.0, 4.0))',
  SINGULAR: 'mat2(vec2(1.0, 2.0), vec2(2.0, 4.0))',
};

const withMatrices = (call) =>
  Object.entries(MATRICES).reduce((text, [word, matrix]) => text.replaceAll(word, matrix), call);

export const FOLDED_CALL_PROBES = [
  ...CASES.map(([word, rows, returns, call]) =>
    probeOf(`fold-call-${word}`, rows, `${returns} probe(float a) { return ${call}; }`)
  ),
  ...LEFT_TO_THE_GPU.flatMap(([word, rows, returns, onConstant, onParameter]) => [
    probeOf(
      `gpu-call-${word}-of-a-constant`,
      rows,
      `${returns} probe(float a) { return ${withMatrices(onConstant)}; }`
    ),
    probeOf(
      `gpu-call-${word}-of-a-parameter`,
      rows,
      `${returns} probe(float a) { return ${withMatrices(onParameter)}; }`
    ),
  ]),
];
