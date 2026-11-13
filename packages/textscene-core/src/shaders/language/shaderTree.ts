/**
 * The typed tree the parser gives and the emitter reads, with Godot's node types
 * (`shader_language.h:372`). Each node that applies an instruction holds its row of the
 * instruction table, so a node is always one of Godot's own instructions, and each node holds
 * where it starts in the text.
 */

import type { InstructionRow } from './instructionTable.generated.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { ValueType } from './types.js';

export type { ValueType } from './types.js';

/** One lane of a constant: a number for `float`, `int` and `uint`, a boolean for `bool`. */
export type Scalar = number | boolean;

/** NODE_TYPE_CONSTANT: a literal, or constants Godot folds into one (`_reduce_expression`). */
export interface ConstantNode {
  readonly kind: 'constant';
  readonly type: ValueType;
  /**
   * One lane each, as Godot holds it (`Scalar`): a 32-bit float, an `int` from -2^31 to 2^31 - 1,
   * a `uint` from 0 to 2^32 - 1, or a boolean.
   */
  readonly values: readonly Scalar[];
  readonly position: SourcePosition;
}

/** NODE_TYPE_VARIABLE: a read of a function argument. */
export interface VariableNode {
  readonly kind: 'variable';
  readonly type: ValueType;
  readonly name: string;
  readonly position: SourcePosition;
}

/**
 * NODE_TYPE_OPERATOR: an operator, `OP_ADD(vec3,float)`, a constructor, `OP_CONSTRUCT` with the
 * overload row `vec3(vec2,float)`, an index, `OP_INDEX`, or the empty expression `;`, `OP_EMPTY`
 * of type `void`.
 */
export interface OperatorNode {
  readonly kind: 'operator';
  readonly type: ValueType;
  /** Godot's enumerator, `OP_ADD` or `OP_CONSTRUCT`. */
  readonly op: string;
  readonly row: InstructionRow;
  readonly operands: readonly Expression[];
  readonly position: SourcePosition;
}

/** NODE_TYPE_MEMBER: a swizzle, `a.zyx`, with the row of its letter set. */
export interface MemberNode {
  readonly kind: 'member';
  readonly type: ValueType;
  readonly owner: Expression;
  /** The letters, as Godot keeps them. */
  readonly name: string;
  readonly row: InstructionRow;
  /** A letter appears twice, so the swizzle cannot be assigned to (`has_swizzling_duplicates`). */
  readonly hasDuplicates: boolean;
  readonly position: SourcePosition;
}

export type Expression = ConstantNode | VariableNode | OperatorNode | MemberNode;

/** NODE_TYPE_CONTROL_FLOW: a `return` of one expression. */
export interface ControlFlowNode {
  readonly kind: 'control flow';
  readonly flow: 'FLOW_OP_RETURN';
  readonly expressions: readonly Expression[];
  readonly position: SourcePosition;
}

export type Statement = Expression | ControlFlowNode;

/** NODE_TYPE_BLOCK: the statements of a function body, in order. */
export interface BlockNode {
  readonly kind: 'block';
  readonly statements: readonly Statement[];
  readonly position: SourcePosition;
}

export interface Argument {
  readonly name: string;
  readonly type: ValueType;
  readonly position: SourcePosition;
}

/** NODE_TYPE_FUNCTION. */
export interface FunctionNode {
  readonly kind: 'function';
  readonly name: string;
  readonly returnType: ValueType;
  readonly arguments: readonly Argument[];
  readonly body: BlockNode;
  readonly position: SourcePosition;
}

/** NODE_TYPE_SHADER. */
export interface ShaderNode {
  readonly kind: 'shader';
  readonly functions: readonly FunctionNode[];
}
