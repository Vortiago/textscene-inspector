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
];

/**
 * Calls glslang leaves to the GPU, each on a constant and on the same value through a parameter,
 * which the browser's compiler cannot fold: on the input 0, `a + 0.899` is `0.899`.
 */
const LEFT_TO_THE_GPU = [
  ['sinh', ['sinh(float)'], 'sinh(0.899)', 'sinh(a + 0.899)'],
  ['atanh', ['atanh(float)'], 'atanh(92.167)', 'atanh(a + 92.167)'],
];

export const FOLDED_CALL_PROBES = [
  ...CASES.map(([word, rows, returns, call]) =>
    probeOf(`fold-call-${word}`, rows, `${returns} probe(float a) { return ${call}; }`)
  ),
  ...LEFT_TO_THE_GPU.flatMap(([word, rows, onConstant, onParameter]) => [
    probeOf(`gpu-call-${word}-of-a-constant`, rows, `float probe(float a) { return ${onConstant}; }`),
    probeOf(`gpu-call-${word}-of-a-parameter`, rows, `float probe(float a) { return ${onParameter}; }`),
  ]),
];
