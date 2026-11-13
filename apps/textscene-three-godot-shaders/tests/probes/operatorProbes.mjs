/**
 * One probe for each typed operator row, constructor, scalar conversion and swizzle set of the
 * instruction table that the float probes of `probes.mjs` leave out. Each applies its row once to
 * arguments of the row's types, so a row is proven on its own.
 */

import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { PROBE_TYPES, VECTOR_PREFIX } from '../../../../scripts/godot-probes/probeShader.mjs';
import { argumentRows } from './inputs.mjs';

/** The shading language token of each operator. A unary operator stands before its operand. */
const OPERATOR_TOKENS = {
  OP_EQUAL: '==',
  OP_NOT_EQUAL: '!=',
  OP_LESS: '<',
  OP_LESS_EQUAL: '<=',
  OP_GREATER: '>',
  OP_GREATER_EQUAL: '>=',
  OP_AND: '&&',
  OP_OR: '||',
  OP_ADD: '+',
  OP_SUB: '-',
  OP_MUL: '*',
  OP_DIV: '/',
  OP_MOD: '%',
  OP_SHIFT_LEFT: '<<',
  OP_SHIFT_RIGHT: '>>',
  OP_BIT_AND: '&',
  OP_BIT_OR: '|',
  OP_BIT_XOR: '^',
  OP_ASSIGN: '=',
  OP_ASSIGN_ADD: '+=',
  OP_ASSIGN_SUB: '-=',
  OP_ASSIGN_MUL: '*=',
  OP_ASSIGN_DIV: '/=',
  OP_ASSIGN_MOD: '%=',
  OP_ASSIGN_SHIFT_LEFT: '<<=',
  OP_ASSIGN_SHIFT_RIGHT: '>>=',
  OP_ASSIGN_BIT_AND: '&=',
  OP_ASSIGN_BIT_OR: '|=',
  OP_ASSIGN_BIT_XOR: '^=',
  OP_NOT: '!',
  OP_NEGATE: '-',
  OP_BIT_INVERT: '~',
};

/**
 * The body of each operator's probe over arguments `a`, `b` and `c`. An assignment returns the
 * argument it changed. An increment reads its argument again, so the probe shows both the value
 * the operator gives and the value it stores.
 */
function probeBody(op) {
  if (op === 'OP_SELECT_IF') return 'return a ? b : c;';
  if (op === 'OP_INCREMENT') return 'return ++a + a;';
  if (op === 'OP_DECREMENT') return 'return --a + a;';
  if (op === 'OP_POST_INCREMENT') return 'return a++ + a;';
  if (op === 'OP_POST_DECREMENT') return 'return a-- + a;';
  const token = OPERATOR_TOKENS[op];
  if (op.startsWith('OP_ASSIGN')) return `a ${token} b; return a;`;
  if (['OP_NOT', 'OP_NEGATE', 'OP_BIT_INVERT'].includes(op)) return `return ${token}a;`;
  return `return a ${token} b;`;
}

const ARGUMENT_NAMES = ['a', 'b', 'c', 'd'];

/** A probe that applies `body` to arguments of `args`, returning `returns`. */
function probeOf(name, row, returns, args, body) {
  const declarations = args.map((type, index) => `${type} ${ARGUMENT_NAMES[index]}`).join(', ');
  return {
    name,
    rows: [row],
    source: `${returns} probe(${declarations}) { ${body} }`,
    inputs: argumentRows(args.map((type) => PROBE_TYPES[type])),
  };
}

/** A probe name from a row id: `OP_ADD(ivec2,int)` is `add-ivec2-int`. */
const probeName = (id) =>
  id
    .replace(/^OP_/, '')
    .replace(/[(),]+/g, '-')
    .replace(/-$/, '')
    .toLowerCase()
    .replaceAll('_', '-');

function operatorProbes(rows) {
  return rows
    .filter((row) => row.family === 'operator' && row.returns !== undefined)
    .map((row) => {
      const op = row.id.slice(0, row.id.indexOf('('));
      return probeOf(probeName(row.id), row.id, row.returns, row.args, probeBody(op));
    });
}

/** The constructors and the scalar conversions, `ivec3(int,ivec2)` and `int(float)`. */
function constructorProbes(rows) {
  return rows
    .filter((row) => row.family === 'constructor' || (row.family === 'function' && row.owner === '#1823'))
    .map((row) => {
      const type = row.id.slice(0, row.id.indexOf('('));
      const names = row.args.map((_, index) => ARGUMENT_NAMES[index]);
      const probe = probeOf(
        `construct-${probeName(row.id)}`,
        row.id,
        row.returns,
        row.args,
        `return ${type}(${names.join(', ')});`
      );
      return { ...probe, rows: [row.id, 'OP_CONSTRUCT'] };
    });
}

/**
 * Each swizzle set, read with one swizzle of each length that reorders and repeats, each lane of
 * the result from a swizzle of another length.
 */
function swizzleProbes(rows) {
  return rows
    .filter((row) => row.family === 'swizzle')
    .map((row) => {
      const [type, set] = row.id.split('.');
      const [a, b, c = a, d = b] = set;
      const result = `${VECTOR_PREFIX[PROBE_TYPES[type].scalar]}4`;
      const body = `return ${result}(a.${b}, a.${b}${a}.y, a.${c}${a}${b}.z, a.${d}${c}${a}${a}.w);`;
      return probeOf(`swizzle-${type}-${set}`, row.id, result, [type], body);
    });
}

/** Every generated probe whose row no probe in `covered` names already. */
export function generatedProbes(covered) {
  const names = new Set(covered.flatMap((probe) => probe.rows));
  return [
    ...operatorProbes(INSTRUCTION_TABLE),
    ...constructorProbes(INSTRUCTION_TABLE),
    ...swizzleProbes(INSTRUCTION_TABLE),
  ].filter((probe) => !names.has(probe.rows[0]));
}
