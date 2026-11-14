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

/**
 * NODE_TYPE_VARIABLE: a read of a function argument or a local variable, or NODE_TYPE_ARRAY for
 * a whole array, whose `arraySize` is its element count. A struct value has its struct's name as
 * its type.
 */
export interface VariableNode {
  readonly kind: 'variable';
  readonly type: ValueType;
  readonly name: string;
  readonly arraySize?: number;
  /** A `const` local: Godot refuses a write to it. */
  readonly isConst?: boolean;
  readonly position: SourcePosition;
}

/** NODE_TYPE_ARRAY with an index: an element of an array variable or of an array member. */
export interface ArrayElementNode {
  readonly kind: 'array element';
  readonly type: ValueType;
  readonly array: Expression;
  readonly index: Expression;
  readonly position: SourcePosition;
}

/** NODE_TYPE_ARRAY_CONSTRUCT: `float[3](a, b, c)` or `{a, b, c}`, its elements in order. */
export interface ArrayConstructNode {
  readonly kind: 'array construct';
  /** The element type. */
  readonly type: ValueType;
  readonly arraySize: number;
  readonly elements: readonly Expression[];
  readonly position: SourcePosition;
}

/** `v.length()`: the element count of an array, an `int` (`shader_language.cpp:3400`). */
export interface ArrayLengthNode {
  readonly kind: 'array length';
  readonly type: 'int';
  readonly array: Expression;
  readonly position: SourcePosition;
}

/** NODE_TYPE_MEMBER on a struct: the member `name` of `owner`. */
export interface FieldNode {
  readonly kind: 'field';
  readonly type: ValueType;
  readonly arraySize?: number;
  readonly owner: Expression;
  readonly name: string;
  readonly position: SourcePosition;
}

/**
 * `a = b` where both are arrays or structs. Godot holds it apart from the operators, whose rows
 * are of value types: an array's in its ArrayNode, a struct's as `OP_ASSIGN` on struct types.
 */
export interface WholeAssignNode {
  readonly kind: 'whole assign';
  readonly type: ValueType;
  readonly arraySize?: number;
  readonly target: Expression;
  readonly value: Expression;
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

/**
 * `f(a, b)`: OP_CALL of a function of the shader, as Godot holds it, with the function's own name,
 * `f@2` for the second overload of `f` (`shader_language.cpp:10962`), and the arguments as its
 * operands. Its type is the function's return type, `void` included, with the array size of an
 * array return.
 */
export interface CallNode extends OperatorNode {
  readonly op: 'OP_CALL';
  readonly function: string;
  /** The qualifier of each parameter, so a pass sees which operands the call writes. */
  readonly qualifiers: readonly Qualifier[];
  readonly arraySize?: number;
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

export type Expression =
  | ConstantNode
  | VariableNode
  | OperatorNode
  | MemberNode
  | ArrayElementNode
  | ArrayConstructNode
  | ArrayLengthNode
  | FieldNode
  | WholeAssignNode;

/** A flow operation of Godot's (`FlowOperation`, `shader_language.h:306`). */
export type Flow =
  | 'FLOW_OP_IF'
  | 'FLOW_OP_RETURN'
  | 'FLOW_OP_FOR'
  | 'FLOW_OP_WHILE'
  | 'FLOW_OP_DO'
  | 'FLOW_OP_BREAK'
  | 'FLOW_OP_SWITCH'
  | 'FLOW_OP_CASE'
  | 'FLOW_OP_DEFAULT'
  | 'FLOW_OP_CONTINUE'
  | 'FLOW_OP_DISCARD';

/**
 * NODE_TYPE_CONTROL_FLOW, with Godot's layout. `if`: the condition, and the then block and an
 * optional else block. `while` and `do`: the condition, and the body. `for`: the blocks of the
 * initialiser, the conditions and the steps, then the body. `switch`: the value, and one block of
 * its `case` and `default` nodes. `case`: the label, and the body. `default`: the body. `return`:
 * the value, if any. `break`, `continue` and `discard`: nothing.
 */
export interface ControlFlowNode {
  readonly kind: 'control flow';
  readonly flow: Flow;
  readonly expressions: readonly Expression[];
  readonly blocks: readonly BlockNode[];
  readonly position: SourcePosition;
}

/** One name of a declaration, its array size, and its value. */
export interface Declarator {
  readonly name: string;
  /** The element count of an array, or nothing for one value. */
  readonly arraySize?: number;
  readonly value?: Expression;
  readonly position: SourcePosition;
}

/** NODE_TYPE_VARIABLE_DECLARATION: `float a = b, c;`, or `const` with a value for each name. */
export interface DeclarationNode {
  readonly kind: 'declaration';
  readonly type: ValueType;
  readonly isConst: boolean;
  readonly declarators: readonly Declarator[];
  readonly position: SourcePosition;
}

export type Statement = Expression | ControlFlowNode | DeclarationNode | BlockNode;

/**
 * NODE_TYPE_BLOCK: statements in order, with a scope. The `for` blocks keep Godot's kinds: the
 * initialiser holds one statement, and the conditions and the steps hold expressions.
 */
export interface BlockNode {
  readonly kind: 'block';
  readonly statements: readonly Statement[];
  readonly position: SourcePosition;
}

/** A member of a struct, with its array size. */
export interface StructMember {
  readonly name: string;
  readonly type: ValueType;
  readonly arraySize?: number;
}

/** NODE_TYPE_STRUCT: `struct Pair { float x; vec2 y; };`. */
export interface StructNode {
  readonly kind: 'struct';
  readonly name: string;
  readonly members: readonly StructMember[];
  readonly position: SourcePosition;
}

/** Whether a parameter takes the caller's value, gives one back, or both (`ArgumentQualifier`). */
export type Qualifier = 'in' | 'out' | 'inout';

/** A parameter of a function, with its array size: `const in float a`, `out int b[2]`. */
export interface Argument {
  readonly name: string;
  readonly type: ValueType;
  readonly qualifier: Qualifier;
  /** A `const` parameter: Godot refuses a write to it. */
  readonly isConst?: boolean;
  readonly arraySize?: number;
  readonly position: SourcePosition;
}

/**
 * NODE_TYPE_FUNCTION. `name` is Godot's own name, `f@2` for the second overload of `f`, and
 * `rname` the name in the text.
 */
export interface FunctionNode {
  readonly kind: 'function';
  readonly name: string;
  readonly rname: string;
  readonly returnType: ValueType;
  readonly returnArraySize?: number;
  readonly arguments: readonly Argument[];
  readonly body: BlockNode;
  readonly position: SourcePosition;
}

/** NODE_TYPE_SHADER: its structs and functions, each in the order of the text. */
export interface ShaderNode {
  readonly kind: 'shader';
  readonly structs: readonly StructNode[];
  readonly functions: readonly FunctionNode[];
}
