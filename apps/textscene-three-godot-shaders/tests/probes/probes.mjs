/**
 * The probes: each one a shading language function `probe` that applies the instructions of its
 * `rows` to a table of inputs. `pnpm godot:probes` runs them in Godot and records Godot's answers,
 * and the real-GL test runs the transpiled function on the same inputs. A probe source is Godot's
 * shading language, so it runs in Godot unchanged.
 */

import { LANE_COUNT, PROBE_TYPES, probeSignature } from '../../../../scripts/godot-probes/probeShader.mjs';
import { argumentRows, pairedVectors, pairs, scalars, vectors } from './inputs.mjs';
import { generatedProbes } from './operatorProbes.mjs';
import { LANGUAGE_PROBES } from './languageProbes.mjs';

/** The float vector types of this slice. */
const VECTORS = ['vec2', 'vec3', 'vec4'];

/** Each arithmetic operator: Godot's enumerator, the shading language token and the word a probe name uses. */
const ARITHMETIC = [
  ['OP_ADD', '+', 'add'],
  ['OP_SUB', '-', 'sub'],
  ['OP_MUL', '*', 'mul'],
  ['OP_DIV', '/', 'div'],
];

/** The inputs of a function of `types`: each scalar pair, or vectors whose lanes differ. */
function inputsFor(types) {
  if (types.every((type) => type === 'float')) return types.length === 1 ? scalars() : pairs();
  if (types.length === 1) return vectors(LANE_COUNT[types[0]]);
  return pairedVectors(types.map((type) => LANE_COUNT[type]));
}

/** The result type of `left op right` for float operands: the vector, when one side is one. */
function resultOf(left, right) {
  return left === 'float' ? right : left;
}

function arithmeticProbes() {
  const operandPairs = [
    ['float', 'float'],
    ...VECTORS.flatMap((vector) => [
      [vector, vector],
      ['float', vector],
      [vector, 'float'],
    ]),
  ];
  return ARITHMETIC.flatMap(([op, token, word]) =>
    operandPairs.map(([left, right]) => ({
      name: `${word}-${left}-${right}`,
      rows: [`${op}(${left},${right})`],
      source: `${resultOf(left, right)} probe(${left} a, ${right} b) { return a ${token} b; }`,
      inputs: inputsFor([left, right]),
    }))
  );
}

function negateProbes() {
  return ['float', ...VECTORS].map((type) => ({
    name: `negate-${type}`,
    rows: [`OP_NEGATE(${type})`],
    source: `${type} probe(${type} a) { return -a; }`,
    inputs: inputsFor([type]),
  }));
}

/**
 * Each float vector constructor overload. The probe passes its arguments through, so a lane
 * shows where each argument lands.
 */
function constructorProbes() {
  const overloads = [
    ['vec2', ['float']],
    ['vec2', ['float', 'float']],
    ['vec3', ['float']],
    ['vec3', ['float', 'float', 'float']],
    ['vec3', ['vec2', 'float']],
    ['vec3', ['float', 'vec2']],
    ['vec4', ['float']],
    ['vec4', ['float', 'float', 'float', 'float']],
    ['vec4', ['float', 'vec2', 'float']],
    ['vec4', ['vec2', 'float', 'float']],
    ['vec4', ['float', 'float', 'vec2']],
    ['vec4', ['float', 'vec3']],
    ['vec4', ['vec3', 'float']],
    ['vec4', ['vec2', 'vec2']],
  ];
  return overloads.map(([type, args]) => {
    const names = args.map((_, index) => `a${index}`);
    return {
      name: `construct-${type}-${args.join('-')}`,
      rows: [`${type}(${args.join(',')})`],
      source: `${type} probe(${args.map((arg, index) => `${arg} ${names[index]}`).join(', ')}) { return ${type}(${names.join(', ')}); }`,
      inputs: pairedVectors(args.map((arg) => LANE_COUNT[arg])),
    };
  });
}

/** The letter sets of each vector type, and one swizzle of each length that reorders and repeats. */
const SWIZZLE_SETS = {
  vec2: ['xy', 'rg', 'st'],
  vec3: ['xyz', 'rgb', 'stp'],
  vec4: ['xyzw', 'rgba', 'stpq'],
};

function swizzleOf(set) {
  const [a, b, c = a, d = b] = set;
  return [`${b}`, `${b}${a}`, `${c}${a}${b}`, `${d}${c}${a}${a}`];
}

function swizzleProbes() {
  return VECTORS.flatMap((type) =>
    SWIZZLE_SETS[type].map((set) => {
      const [one, two, three, four] = swizzleOf(set);
      return {
        name: `swizzle-${type}-${set}`,
        rows: [`${type}.${set}`],
        source: `vec4 probe(${type} a) { return vec4(a.${one}, 0.0, 0.0, 0.0) + vec4(a.${two}, 0.0, 0.0) * 2.0 + vec4(a.${three}, 0.0) * 4.0 + a.${four} * 8.0; }`,
        inputs: vectors(LANE_COUNT[type]),
      };
    })
  );
}

/**
 * Float literals, each probe four of them through a constant `vec4`, which Godot folds and writes
 * back as text (`shader_compiler.cpp:180`). The cases are where that text loses the value: digits
 * past 14 decimals, values under 1e-14, the largest floats and the forms the tokenizer reads.
 */
const LITERAL_GROUPS = [
  ['0.0', '1.0', '-1.0', '0.5'],
  ['0.1', '3.14159265358979', '1e3', '2.5e-3'],
  ['1e-20', '1.5e-14', '1.0e-7', '0.000012345678'],
  ['3.4028234e38', '1e38', '123456789.0', '16777217.0'],
  ['1.f', '2.5f', '.5', '1e+2'],
  ['-0.0', '1E2', '0.30000001192092896', '7.0e-45'],
];

function literalProbes() {
  const group = LITERAL_GROUPS.map((literals, index) => ({
    name: `literal-${index}`,
    rows: ['float literal'],
    source: `vec4 probe() { return vec4(${literals.join(', ')}); }`,
    inputs: [[]],
  }));
  const plain = {
    name: 'literal-unfolded',
    rows: ['float literal'],
    source: 'float probe(float a) { return a * 0.1 + 1e-20 + 3.4028234e38 * 0.0; }',
    inputs: scalars(),
  };
  const overflow = {
    name: 'literal-overflow',
    rows: ['float literal'],
    source: 'float probe() { return 1e39; }',
    inputs: [[]],
  };
  return [...group, plain, overflow];
}

/**
 * Negation of an operand whose text Godot already starts with `-`: Godot writes the operand alone
 * (`shader_compiler.cpp:1141`), so `-(-a)` draws as `-a`. A negated constant is folded first
 * (`shader_language.cpp:7840`), so `-(-1.5)` draws as 1.5.
 */
function nestedNegationProbes() {
  const cases = [
    ['vector', 'vec2', 'vec2 probe(vec2 a) { return -(-a); }', vectors(2)],
    ['scalar', 'float', 'float probe(float a) { return -(-a); }', scalars()],
    ['triple', 'float', 'float probe(float a) { return -(-(-a)); }', scalars()],
    ['constructor', 'vec2', 'vec2 probe(float a) { return -(-vec2(a, 0.499)); }', scalars()],
    ['swizzle', 'float', 'float probe(vec2 a) { return -((-a).y); }', vectors(2)],
    ['sum', 'float', 'float probe(float a, float b) { return -(-(a + b)); }', pairs()],
    ['constant', 'float', 'float probe(float a) { return -(-1.5) + a; }', scalars()],
    ['constant-vector', 'vec2', 'vec2 probe(float a) { return -(-vec2(1.5, 0.25)) * a; }', scalars()],
  ];
  return cases.map(([word, type, source, inputs]) => ({
    name: `negate-nested-${word}`,
    rows: [`OP_NEGATE(${type})`],
    source,
    inputs,
  }));
}

/**
 * Arithmetic of constants alone, which Godot's GLSL compiler folds in double precision from the
 * text Godot writes, and rounds once. A fold in 32-bit floats lands one unit off on these values.
 */
function constantFoldingProbes() {
  const cases = [
    ['sum', 'float probe(float a) { return 58.656 + 74.377 + a; }'],
    ['chain', 'float probe(float a) { return 0.1 + 0.2 + 0.3 + a; }'],
    ['difference-quotient', 'float probe(float a) { return (33.135 - 0.886) / 69.143 * a; }'],
    ['vector-scalar', 'vec4 probe(float a) { return vec3(58.656).bggr + 74.377 + a; }'],
    ['quotient-vector', 'vec2 probe(float a) { return (71.543 + 54.854) / vec2(a, 0.5); }'],
    ['swizzle', 'float probe(float a) { return ((68.452 * vec3(797.08) + vec2(51.97).t).zx).t + a; }'],
    ['negated-sum', 'float probe(float a) { return -(0.1 + 0.2) + a; }'],
    ['overflow', 'vec2 probe(float a) { return vec2(3e38 * 10.0, -(3e38 * 10.0)) + a; }'],
    ['negative-zero', 'vec2 probe(float a) { return vec2(-0.0 * 1.0, a); }'],
    ['division-by-zero', 'vec3 probe(float a) { return vec3(1.0 / 0.0, -1.0 / 0.0, a); }'],
  ];
  return [...cases, ...foldValueCheckCases()].map(([word, source]) => ({
    name: `fold-${word}`,
    rows: ['float literal'],
    source,
    inputs: scalars(),
  }));
}

/**
 * One chain of two operators for each pair of the four, with literals where a fold in 32-bit
 * floats and glslang's fold in double precision give different floats. Each chain also runs as a
 * vector, a vector with a scalar, and a swizzle of a constant vector.
 */
const FOLD_CHAINS = [
  ['add-div', '(1.9335 + 590.3) / 0.3025'],
  ['div-div', '(7425.1 / 0.33901) / 0.65885'],
  ['mul-sub', '(8.4027 * 353.27) - 586.87'],
  ['sub-mul', '(0.8625 - 52.507) * 29.5'],
  ['mul-div', '(2451.2 * 119.05) / 3344.5'],
  ['add-sub', '(51.329 + 7099.9) - 15.779'],
  ['div-add', '(8422.0 / 0.43832) + 0.51635'],
  ['div-mul', '(0.19178 / 784.84) * 790.63'],
  ['mul-add', '(980.94 * 7332.8) + 6.1585'],
  ['mul-mul', '(5.5115 * 0.48388) * 35.078'],
  ['sub-sub', '(630.75 - 0.75847) - 27.71'],
  ['add-add', '(0.75454 + 80.042) + 516.6'],
];

function foldValueCheckCases() {
  const scalar = FOLD_CHAINS.map(([word, chain]) => [
    `chain-${word}`,
    `float probe(float a) { return ${chain} + a; }`,
  ]);
  const vectors = [
    [
      'mixed-vector',
      'vec2 probe(float a) { return (vec2(1.9335, 8422.0) + vec2(590.3, 0.43832)) / vec2(0.3025, 784.84) + a; }',
    ],
    [
      'mixed-vector-scalar',
      'vec3 probe(float a) { return (vec3(8.4027, 2451.2, 980.94) * 353.27 - 586.87) * a; }',
    ],
    [
      'mixed-scalar-vector',
      'vec2 probe(float a) { return 0.8625 - vec2(52.507, 0.75847) * vec2(29.5, 27.71) + a; }',
    ],
    [
      'mixed-swizzle',
      'vec2 probe(float a) { return vec4(51.329, 7099.9, 630.75, 0.75847).yw - vec2(15.779, 27.71).yx + a; }',
    ],
  ];
  return [...scalar, ...vectors];
}

/** A function of the whole family together: Godot's evaluation order and every form at once. */
function combinedProbe() {
  return {
    name: 'arithmetic-combined',
    rows: [],
    source:
      'vec3 probe(vec3 a, float b) { return -(a.zyx * b + vec3(a.xy / (b - 0.5), 2.0)) - a / 3.0 * vec3(1.5, -2.0, b).yxz; }',
    inputs: pairedVectors([3, 1]),
  };
}

/**
 * Integer and boolean literals, folded into constants as Godot folds them. A literal past the int
 * range is -2^31 in Godot, and a uint literal past 32 bits wraps.
 */
function integerLiteralProbes() {
  const cases = [
    ['int', 'ivec4 probe() { return ivec4(0, -1, 2147483647, -2147483648); }', 'int literal'],
    [
      'int-overflow',
      'ivec4 probe() { return ivec4(2147483648, 99999999999, 0xffffffff, 0x7fffffff); }',
      'int literal',
    ],
    ['int-unfolded', 'int probe(int a) { return a * 3 + 2147483647; }', 'int literal'],
    ['uint', 'uvec4 probe() { return uvec4(0u, 1u, 4294967295u, 0x80000000u); }', 'uint literal'],
    ['uint-overflow', 'uvec2 probe() { return uvec2(4294967296u, 4294967297u); }', 'uint literal'],
    ['uint-negated', 'uvec2 probe() { return uvec2(-1u, -0x80000000u); }', 'uint literal'],
    ['bool', 'bvec2 probe() { return bvec2(true, false); }', 'true'],
    ['bool-false', 'bool probe(bool a) { return a == false; }', 'false'],
  ];
  return cases.map(([word, source, row]) => ({ name: `literal-${word}`, rows: [row], source, inputs: [[]] }));
}

/**
 * A ternary part keeps the node Godot reads before it folds the part, and the fold negates a
 * constant in place, so a negated constant there draws with the opposite sign
 * (`shader_language.cpp:7832`).
 */
function ternaryProbes() {
  const cases = [
    ['negated-vector', 'vec2 probe(bool c) { return c ? -vec2(1.0, 2.0) : vec2(3.0); }'],
    ['negated-else', 'vec2 probe(bool c) { return c ? vec2(3.0) : -vec2(1.0, 2.0); }'],
    ['double-negation', 'float probe(bool c) { return c ? -(-1.0) : 3.0; }'],
    ['negated-int', 'ivec2 probe(bool c) { return c ? -ivec2(1, 2) : ivec2(3); }'],
    ['nested', 'float probe(bool c, float a) { return c ? !c ? a : -a : a * 2.0; }'],
  ];
  return cases.map(([word, source]) => {
    const { returns, parameters } = probeSignature(source);
    return {
      name: `ternary-${word}`,
      rows: [`OP_SELECT_IF(bool,${returns},${returns})`, 'OP_SELECT_ELSE'],
      source,
      inputs: argumentRows(parameters.map((type) => PROBE_TYPES[type])),
    };
  });
}

/** The float probes of one row each, which the generated probes do not repeat. */
const FLOAT_ROW_PROBES = [
  ...arithmeticProbes(),
  ...negateProbes(),
  ...constructorProbes(),
  ...swizzleProbes(),
];

export const PROBES = [
  ...FLOAT_ROW_PROBES,
  ...literalProbes(),
  ...nestedNegationProbes(),
  ...constantFoldingProbes(),
  ...integerLiteralProbes(),
  ...ternaryProbes(),
  combinedProbe(),
  ...LANGUAGE_PROBES,
  ...generatedProbes(FLOAT_ROW_PROBES),
];
