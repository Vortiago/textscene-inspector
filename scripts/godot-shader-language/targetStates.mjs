/**
 * The state of each transpiled row on each target the transpiler emits for: WebGL 2 through
 * three's handler, and WebGPURenderer. A row is native when its TSL node is the GLSL or WGSL
 * operation itself, and lowered when the emitter writes it as other operations, named here.
 */

/** The targets, as the table names them. */
export const TARGETS = ['webgl2', 'webgpu'];

const isMatrix = (type) => /^mat\d$/.test(type);
const isVector = (type) => /^[biu]?vec\d$/.test(type);

const OPERATOR_OF_ASSIGNMENT = /^OP_ASSIGN_(\w+)$/;
const STEPS = /^OP_(POST_)?(INCREMENT|DECREMENT)$/;

/** The operators the emitter applies column by column between a matrix and a scalar (`columnwise`). */
const COLUMNWISE = /^OP_(ADD|SUB|MUL|DIV)$/;

/** The lowering of the operator `op` over `args`, or nothing for a native one. */
function operatorLowering(op, args) {
  const [first, second] = args;
  if (op === 'OP_DIV' && isMatrix(first) && second === 'float') return 'product with the reciprocal';
  const isMatrixByScalar = (isMatrix(first) && second === 'float') || (first === 'float' && isMatrix(second));
  if (COLUMNWISE.test(op) && isMatrixByScalar) return 'column by column';
  if (op === 'OP_EQUAL' || op === 'OP_NOT_EQUAL') {
    if (isMatrix(first)) return 'column by column';
    if (isVector(first)) return op === 'OP_EQUAL' ? 'all(equal(a, b))' : 'any(notEqual(a, b))';
  }
  if (op === 'OP_AND' || op === 'OP_OR') return 'select';
  return undefined;
}

/** The lowering of `row` on every target, or nothing for a native row. */
function lowering(row) {
  if (/^(lowp|mediump|highp)$/.test(row.id)) return 'dropped: every float is 32-bit';
  if (row.family === 'constructor' && isMatrix(row.returns) && row.args.length === 1)
    return 'diagonal of columns';
  if (row.family !== 'operator' || row.args === undefined) return undefined;
  const op = row.id.slice(0, row.id.indexOf('('));
  if (op === 'OP_ASSIGN' || STEPS.test(op)) return 'written to the argument value';
  const assigned = OPERATOR_OF_ASSIGNMENT.exec(op);
  if (assigned) {
    const inner = operatorLowering(`OP_${assigned[1]}`, row.args);
    return `written to the argument value${inner ? `, ${inner}` : ''}`;
  }
  return operatorLowering(op, row.args);
}

/** The state of the transpiled row `row` on each target: `native` or `lowered: <name>`. */
export function targetStates(row) {
  const name = lowering(row);
  const state = name === undefined ? 'native' : `lowered: ${name}`;
  return Object.fromEntries(TARGETS.map((target) => [target, state]));
}
