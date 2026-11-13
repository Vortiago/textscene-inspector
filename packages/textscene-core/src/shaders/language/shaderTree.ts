/**
 * The typed tree the parser gives and the emitter reads. Each node that applies an instruction
 * holds its row of the instruction table, so a node is always one of Godot's own instructions.
 */

import type { InstructionRow } from './instructionTable.generated.js';

/** A Godot type name, `float` or `vec3`. */
export type ValueType = string;

export type Expression = Constant | ParameterRead | OperatorApplication | Construction | Swizzle;

/**
 * A literal, or a constructor or negation of constants, which Godot folds into one constant
 * (`_reduce_expression`, `shader_language.cpp:7840`).
 */
export interface Constant {
  readonly kind: 'constant';
  readonly type: ValueType;
  /** One 32-bit float per lane, as Godot holds it (`Scalar::real`). */
  readonly values: readonly number[];
}

export interface ParameterRead {
  readonly kind: 'parameter';
  readonly type: ValueType;
  readonly index: number;
}

/** A unary or binary operator, `OP_NEGATE(vec3)` or `OP_ADD(vec3,float)`. */
export interface OperatorApplication {
  readonly kind: 'operator';
  readonly type: ValueType;
  readonly row: InstructionRow;
  readonly operands: readonly Expression[];
}

/** A constructor overload, `vec3(vec2,float)`. */
export interface Construction {
  readonly kind: 'constructor';
  readonly type: ValueType;
  readonly row: InstructionRow;
  readonly args: readonly Expression[];
}

/** A swizzle: the lanes of `base` it reads, 0 for x, r and s. */
export interface Swizzle {
  readonly kind: 'swizzle';
  readonly type: ValueType;
  readonly row: InstructionRow;
  readonly base: Expression;
  readonly lanes: readonly number[];
}

export interface Parameter {
  readonly name: string;
  readonly type: ValueType;
}

/** A function whose body is one `return` of `result`. */
export interface FunctionDefinition {
  readonly name: string;
  readonly returnType: ValueType;
  readonly parameters: readonly Parameter[];
  readonly result: Expression;
}

export interface ShaderTree {
  readonly functions: readonly FunctionDefinition[];
}
