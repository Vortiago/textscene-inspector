/**
 * The emitter: the typed tree to three.js TSL nodes. Each node of the tree becomes the TSL node of
 * the same GLSL operation, so the GPU computes what Godot's GLSL computes.
 */

import { float, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { Expression, FunctionDefinition, Parameter, ValueType } from './shaderTree.js';

/** A function of the shader as TSL: `call` builds its result from one node per parameter. */
export interface TranslatedFunction {
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

export function emitFunction(definition: FunctionDefinition): TranslatedFunction {
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
      return emit(definition.result, args);
    },
  };
}

function emit(expression: Expression, args: readonly Node[]): Node {
  switch (expression.kind) {
    // A literal is never negative: `-0.0` is OP_NEGATE of 0.0, so three's text, which writes
    // `String(-0)` as `0`, never meets a negative zero.
    case 'float literal':
      return float(expression.value);
    case 'parameter':
      return args[expression.index]!;
    case 'operator':
      return emitOperator(
        expression.row.id,
        expression.operands.map((operand) => emit(operand, args))
      );
    case 'constructor':
      return CONSTRUCTORS[expression.type]!(...expression.args.map((arg) => emit(arg, args)));
    case 'swizzle': {
      const letters = expression.lanes.map((lane) => LANE_LETTERS[lane]).join('');
      return (emit(expression.base, args) as unknown as Record<string, Node>)[letters]!;
    }
  }
}

/** The TSL operation of an operator row, `OP_ADD(vec3,float)`. */
function emitOperator(rowId: string, operands: readonly Node[]): Node {
  const [first, second] = operands as [Node & ArithmeticNode, Node];
  switch (rowId.slice(0, rowId.indexOf('('))) {
    case 'OP_ADD':
      return first.add(second);
    case 'OP_SUB':
      return first.sub(second);
    case 'OP_MUL':
      return first.mul(second);
    case 'OP_DIV':
      return first.div(second);
    case 'OP_NEGATE':
      return first.negate();
    default:
      throw new Error(`expected an operator the parser reads, got ${rowId}`);
  }
}
