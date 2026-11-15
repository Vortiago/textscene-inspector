/**
 * The state of each transpiled row on each target the transpiler emits for: WebGL 2 through
 * three's handler, and WebGPURenderer. A row is native when its TSL node is the GLSL or WGSL
 * operation itself, and lowered when the emitter writes it as other operations, named here.
 */

/** The targets, as the table names them. */
export const TARGETS = ['webgl2', 'webgpu'];

/** What the guide and the table say for WebGPURenderer: no probe runs there yet. */
export const WEBGPU_STATE = 'untested (#1788)';

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

/** The composite of TSL nodes the emitter builds for each built-in three/tsl has no function for. */
const FUNCTION_COMPOSITES = {
  roundEven: 'floor(x) + mod(floor(x), 2) at a half',
  modf: 'trunc(x) and x - trunc(x)',
  isnan: 'x != x',
  isinf: 'abs(x) == infinity',
  matrixCompMult: 'column by column',
  outerProduct: 'column by column',
  bitCount: 'sums of bit pairs, nibbles and bytes',
  findLSB: 'bit count below the lowest set bit',
  findMSB: 'bit count of the bits filled below the top',
  bitfieldReverse: 'swaps of bits, pairs, nibbles, bytes and halves',
  bitfieldExtract: 'shifts to the top and back',
  bitfieldInsert: 'shifted mask',
  uaddCarry: 'wrapped sum and comparison',
  usubBorrow: 'wrapped difference and comparison',
  umulExtended: 'products of 16-bit halves',
  imulExtended: 'products of 16-bit halves, less each negative operand',
  frexp: 'exponent and fraction bits',
  ldexp: 'three products by powers of two',
  dFdxCoarse: 'nearest form dFdx, coarse not shown on the test driver',
  dFdxFine: 'nearest form dFdx, fine not shown on the test driver',
  dFdyCoarse: 'nearest form dFdy, coarse not shown on the test driver',
  dFdyFine: 'nearest form dFdy, fine not shown on the test driver',
  fwidthCoarse: 'nearest form fwidth, coarse not shown on the test driver',
  fwidthFine: 'nearest form fwidth, fine not shown on the test driver',
  fma: 'nearest form a * b + c, which a driver may fuse',
};

const THREE_POLYFILLS = {
  packSnorm4x8: "three's tsl_packSnorm4x8",
  packUnorm4x8: "three's tsl_packUnorm4x8",
  unpackSnorm4x8: "three's tsl_unpackSnorm4x8",
  unpackUnorm4x8: "three's tsl_unpackUnorm4x8",
};

const functionName = (row) => row.id.slice(0, row.id.indexOf('('));

/** The composite of the built-in function `row`, or nothing where three/tsl has its function. */
function functionComposite(row) {
  const name = functionName(row);
  if (name === 'mix' && row.args[2]?.startsWith('b')) return 'select by lane';
  return FUNCTION_COMPOSITES[name];
}

/** The lowering of `row` on every target, or nothing for a native row. */
function lowering(row) {
  if (/^(lowp|mediump|highp)$/.test(row.id)) return 'dropped: every float is 32-bit';
  if (row.family === 'constructor' && isMatrix(row.returns) && row.args.length === 1)
    return 'diagonal of columns';
  if (row.family.startsWith('function') && row.args !== undefined) return functionComposite(row);
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
  const stateOf = (name) => (name === undefined ? 'native' : `lowered: ${name}`);
  const states = Object.fromEntries(TARGETS.map((target) => [target, stateOf(lowering(row))]));
  const polyfill = row.family.startsWith('function') ? THREE_POLYFILLS[functionName(row)] : undefined;
  return polyfill === undefined ? states : { ...states, webgl2: stateOf(polyfill) };
}
