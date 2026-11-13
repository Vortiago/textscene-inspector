/**
 * The emitter: the typed tree to three.js TSL nodes. Each node of the tree becomes the TSL node of
 * the same GLSL operation, so the GPU computes what Godot's GLSL computes.
 */

import { float, uint, uintBitsToFloat, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { dropsNegation, GlslangFolding } from './godotGlsl.js';
import { operatorOfRow, type TranspiledOperator } from './operators.js';
import type { Expression, FunctionDefinition, Parameter, ValueType } from './shaderTree.js';

/** A function of the shader as TSL: `call` builds its result from one node per parameter. */
export interface TranspiledFunction {
  readonly name: string;
  readonly returnType: ValueType;
  readonly parameters: readonly Parameter[];
  call(args: readonly Node[]): Node;
}

/** The methods of a TSL node that the emitter calls, which three's types leave out. */
interface ArithmeticNode {
  add(other: Node): Node;
  sub(other: Node): Node;
  mul(other: Node): Node;
  div(other: Node): Node;
  negate(): Node;
}

/** three's types take no node list here, though each constructor takes one. */
type Constructor = (...args: Node[]) => Node;
const CONSTRUCTORS: Readonly<Record<string, Constructor>> = {
  vec2: vec2 as unknown as Constructor,
  vec3: vec3 as unknown as Constructor,
  vec4: vec4 as unknown as Constructor,
};

const LANE_LETTERS = 'xyzw';

export function emitFunction(definition: FunctionDefinition): TranspiledFunction {
  const folding = new GlslangFolding();
  return {
    name: definition.name,
    returnType: definition.returnType,
    parameters: definition.parameters,
    call(args) {
      if (args.length !== definition.parameters.length) {
        throw new Error(
          `expected ${definition.parameters.length} arguments for ${definition.name}, got ${args.length}`
        );
      }
      return emit(definition.result, { args, folding });
    },
  };
}

/** What emitting one call of a function reads: its argument nodes and its tree's folded constants. */
interface EmitContext {
  readonly args: readonly Node[];
  readonly folding: GlslangFolding;
}

function emit(expression: Expression, context: EmitContext): Node {
  const folded = context.folding.lanesOf(expression);
  if (folded) return constantNode(expression.type, folded);
  switch (expression.kind) {
    case 'constant':
      throw new Error(`expected glslang to fold the constant ${expression.values.join(', ')}`);
    case 'parameter':
      return context.args[expression.index]!;
    case 'operator': {
      const op = operatorOfRow(expression.row.id);
      if (op === 'OP_NEGATE' && dropsNegation(expression)) return emit(expression.operands[0]!, context);
      const [first, second] = expression.operands.map((operand) => emit(operand, context));
      return OPERATIONS[op](first as Node & ArithmeticNode, second!);
    }
    case 'constructor':
      return CONSTRUCTORS[expression.type]!(...expression.args.map((arg) => emit(arg, context)));
    case 'swizzle': {
      const letters = expression.lanes.map((lane) => LANE_LETTERS[lane]).join('');
      return (emit(expression.base, context) as unknown as Record<string, Node>)[letters]!;
    }
  }
}

/** The constant of `type` with glslang's folded `lanes`, each rounded once to a 32-bit float. */
function constantNode(type: ValueType, lanes: readonly number[]): Node {
  const components = lanes.map((lane) => floatNode(Math.fround(lane)));
  return type === 'float' ? components[0]! : CONSTRUCTORS[type]!(...components);
}

/**
 * The float `value`. three writes -0 as `0.0` and infinity as `Infinity.0` (`_toFloat` of its
 * node builder), so those, and NaN, are written as their bits.
 */
function floatNode(value: number): Node {
  if (Number.isFinite(value) && !Object.is(value, -0)) return float(value);
  return uintBitsToFloat(uint(new Uint32Array(new Float32Array([value]).buffer)[0]!)) as unknown as Node;
}

/** The TSL operation of each operator, by Godot's enumerator. */
const OPERATIONS: Readonly<Record<TranspiledOperator, (first: ArithmeticNode, second: Node) => Node>> = {
  OP_ADD: (first, second) => first.add(second),
  OP_SUB: (first, second) => first.sub(second),
  OP_MUL: (first, second) => first.mul(second),
  OP_DIV: (first, second) => first.div(second),
  OP_NEGATE: (first) => first.negate(),
};
