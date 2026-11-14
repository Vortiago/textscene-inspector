/**
 * One probe for each overload of the built-in functions of Godot's `builtin_func_defs` that slice
 * T5 owns: trigonometric, exponential, common, geometric, matrix and vector relational, and the
 * vector and matrix conversions. Each calls its overload once on arguments of the overload's types.
 */

import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { PROBE_TYPES } from '../../../../scripts/godot-probes/probeShader.mjs';
import { argumentRows } from './inputs.mjs';
import { probeOf as sourceProbe } from './languageProbes.mjs';

const OWNER = '#1826';
const ARGUMENT_NAMES = ['a', 'b', 'c'];
const TYPE_NAME = /^(?:[biu]?vec\d|mat\d)$/;

const nameOf = (row) => row.id.slice(0, row.id.indexOf('('));

/** A probe name from a row id: `clamp(vec2,float,float)` is `call-clamp-vec2-float-float`. */
const probeName = (id) => `call-${id.replace(/[(),]+/g, '-').replace(/-$/, '')}`;

function probeOf(name, rows, returns, args, body) {
  const declarations = args.map((type, index) => `${type} ${ARGUMENT_NAMES[index]}`).join(', ');
  return {
    name,
    rows,
    source: `${returns} probe(${declarations}) { ${body} }`,
    inputs: argumentRows(args.map((type) => PROBE_TYPES[type])),
  };
}

/** A call that returns its value: `return clamp(a, b, c);`, or a conversion `return ivec2(a);`. */
function valueProbe(row) {
  const name = nameOf(row);
  const call = `${name}(${row.args.map((_, index) => ARGUMENT_NAMES[index]).join(', ')})`;
  const rows = TYPE_NAME.test(name) ? [row.id, 'OP_CONSTRUCT'] : [row.id];
  return probeOf(probeName(row.id), rows, row.returns, row.args, `return ${call};`);
}

/**
 * The two probes of a `modf` overload, whose second argument is an out argument
 * (`builtin_func_out_args`): one returns the fraction, the other the whole part it writes.
 */
function modfProbes(row) {
  const [type] = row.args;
  const local = `${type} whole = ${type}(0.0);`;
  return [
    probeOf(`${probeName(row.id)}-fraction`, [row.id], type, [type], `${local} return modf(a, whole);`),
    probeOf(`${probeName(row.id)}-whole`, [row.id], type, [type], `${local} modf(a, whole); return whole;`),
  ];
}

/**
 * The resolution of a call: a scalar constant converted to the overload's type, the places an out
 * argument takes, and the forms Godot refuses with their messages.
 */
function resolutionProbes() {
  const cases = [
    ['int-constant-to-float', ['max(float,float)'], 'float probe(float a) { return max(a, 1); }'],
    ['uint-constant-to-int', ['min(ivec2,int)'], 'ivec2 probe(ivec2 a) { return min(a, 3u); }'],
    [
      'out-to-a-swizzle',
      ['modf(float,float)'],
      'vec2 probe(vec2 a) { vec2 w = vec2(0.0); float f = modf(a.x, w.y); return vec2(f, w.y); }',
    ],
    [
      'out-to-an-element',
      ['modf(float,float)'],
      'vec2 probe(float a) { float w[2] = float[2](0.0, 0.0); float f = modf(a, w[1]); return vec2(f, w[1]); }',
    ],
    ['wrong-type', ['sin(float)'], 'float probe(bool a) {\n\treturn sin(a);\n}'],
    ['too-many', ['sin(float)'], 'float probe(float a) {\n\treturn sin(a, a);\n}'],
    [
      'whole-array',
      ['length(float)'],
      'float probe(float a) {\n\tfloat v[2] = float[2](a, a);\n\treturn length(v);\n}',
    ],
    ['out-to-a-constant', ['modf(float,float)'], 'float probe(float a) {\n\treturn modf(a, 1.0);\n}'],
    ['out-to-a-value', ['modf(float,float)'], 'float probe(float a) {\n\treturn modf(a, a + 1.0);\n}'],
    [
      'out-to-a-const',
      ['modf(float,float)'],
      'float probe(float a) {\n\tconst float w = 1.0;\n\treturn modf(a, w);\n}',
    ],
  ];
  return cases.map(([word, rows, source]) => sourceProbe(`call-${word}`, rows, source));
}

export const BUILT_IN_FUNCTION_PROBES = [
  ...INSTRUCTION_TABLE.filter((row) => row.family === 'function' && row.owner === OWNER).flatMap((row) =>
    nameOf(row) === 'modf' ? modfProbes(row) : [valueProbe(row)]
  ),
  ...resolutionProbes(),
];
