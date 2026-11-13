/**
 * The probes: each one a shading language function `probe` that applies the instructions of its
 * `rows` to a table of inputs. `pnpm godot:probes` runs them in Godot and records Godot's answers,
 * and the real-GL test runs the transpiled function on the same inputs. A probe source is Godot's
 * shading language, so it runs in Godot unchanged.
 */

import { LANE_COUNT } from '../../../../scripts/godot-probes/probeShader.mjs';
import { pairedVectors, pairs, scalars, vectors } from './inputs.mjs';

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

export const PROBES = [
  ...arithmeticProbes(),
  ...negateProbes(),
  ...constructorProbes(),
  ...swizzleProbes(),
  ...literalProbes(),
  combinedProbe(),
];
