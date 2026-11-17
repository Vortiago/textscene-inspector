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
  /** Godot's `Scalar`: a 32-bit float, an `int`, a `uint` or a boolean. */
  readonly values: readonly Scalar[];
  readonly position: SourcePosition;
}

/** NODE_TYPE_VARIABLE, or NODE_TYPE_ARRAY for a whole array. A struct value's type is its struct's name. */
export interface VariableNode {
  readonly kind: 'variable';
  readonly type: ValueType;
  readonly name: string;
  readonly arraySize?: number;
  /** A `const` local: Godot refuses a write to it. */
  readonly isConst?: boolean;
  /** The row of a built-in of the shader type, `sky.sky.COLOR`, which the link step renames. */
  readonly builtIn?: string;
  /** A uniform: Godot refuses a write to it, and the material gives its value. */
  readonly isUniform?: boolean;
  /** A varying, which carries a value from one stage function to the next. */
  readonly isVarying?: boolean;
  readonly position: SourcePosition;
}

/** NODE_TYPE_ARRAY with an index: an element of an array variable or of an array member. */
export interface ArrayElementNode {
  readonly kind: 'array element';
  readonly type: ValueType;
  readonly array: Expression;
  readonly index: Expression;
  /** The size of an element that is an array itself: only GLSL has arrays of arrays. */
  readonly arraySize?: number;
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

/** `a = b` of arrays or structs, which Godot holds apart from the value-type operator rows. */
export interface WholeAssignNode {
  readonly kind: 'whole assign';
  readonly type: ValueType;
  readonly arraySize?: number;
  readonly target: Expression;
  readonly value: Expression;
  readonly position: SourcePosition;
}

/** NODE_TYPE_OPERATOR: an operator, `OP_CONSTRUCT`, `OP_INDEX`, or `OP_EMPTY` of type `void`. */
export interface OperatorNode {
  readonly kind: 'operator';
  readonly type: ValueType;
  /** Godot's enumerator, `OP_ADD` or `OP_CONSTRUCT`. */
  readonly op: string;
  readonly row: InstructionRow;
  readonly operands: readonly Expression[];
  readonly position: SourcePosition;
}

/** OP_CALL as Godot holds it, `f@2` for the second `f` (`shader_language.cpp:10962`). */
export interface CallNode extends OperatorNode {
  readonly op: 'OP_CALL';
  /** Godot's name of the function, which tells overloads apart. */
  readonly function: string;
  /** The function's name in the text. */
  readonly rname: string;
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

/** NODE_TYPE_CONTROL_FLOW, with Godot's layout of blocks and expressions for each flow. */
export interface ControlFlowNode {
  readonly kind: 'control flow';
  readonly flow: Flow;
  readonly expressions: readonly Expression[];
  readonly blocks: readonly BlockNode[];
  /** A template's attributes before the statement, `[[dont_unroll]]`. Godot's own text has none. */
  readonly attributes?: readonly string[];
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
  /** A template's precision words before the type, `highp`. Godot's own text has none here. */
  readonly words?: readonly string[];
  readonly position: SourcePosition;
}

/** `#CODE : SKY` (`shader_rd.cpp:77`): the link step puts the material's statements here. */
export interface SlotStatementNode {
  readonly kind: 'slot';
  /** The stage function, upper case: `SKY`. */
  readonly name: string;
  readonly position: SourcePosition;
}

export type Statement = Expression | ControlFlowNode | DeclarationNode | BlockNode | SlotStatementNode;

/** NODE_TYPE_BLOCK. A `for` initialiser holds one statement, and its conditions and steps expressions. */
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
  /** A template parameter's other qualifier words: `readonly`, `highp`. */
  readonly words?: readonly string[];
  readonly position: SourcePosition;
}

/** NODE_TYPE_FUNCTION: `name` is Godot's, `f@2` for the second `f`, and `rname` the text's. */
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

/** Godot's `ShaderNode::Uniform::Hint`, by the name `get_uniform_hint_name` gives it, or `none`. */
export type UniformHint =
  | 'none'
  | 'hint_range'
  | 'hint_enum'
  | 'source_color'
  | 'color_conversion_disabled'
  | 'hint_normal'
  | 'hint_roughness_normal'
  | 'hint_roughness_r'
  | 'hint_roughness_g'
  | 'hint_roughness_b'
  | 'hint_roughness_a'
  | 'hint_roughness_gray'
  | 'hint_default_black'
  | 'hint_default_white'
  | 'hint_default_transparent'
  | 'hint_anisotropy'
  | 'hint_screen_texture'
  | 'hint_normal_roughness_texture'
  | 'hint_depth_texture';

/** Where a uniform's value lives: the material, each instance, or the project's global uniforms. */
export type UniformScope = 'local' | 'instance' | 'global';

/** `ShaderNode::Uniform` (`shader_language.h:660`), with the rows of the words that declare it. */
export interface UniformNode {
  readonly kind: 'uniform';
  readonly name: string;
  readonly type: ValueType;
  readonly arraySize?: number;
  readonly scope: UniformScope;
  readonly hint: UniformHint;
  /** `source_color` on a sampler, which keeps the hint free for a texture hint. */
  readonly usesColor: boolean;
  /** The sampler setting `filter_*`, or nothing for the default. */
  readonly filter?: string;
  /** The sampler setting `repeat_*`, or nothing for the default. */
  readonly repeat?: string;
  /** `hint_range(min, max, step)`, 32-bit floats as Godot keeps them. */
  readonly range: readonly [number, number, number];
  readonly enumNames: readonly string[];
  /** `instance_index(n)`, or the next free index of an `instance` uniform. */
  readonly instanceIndex?: number;
  readonly group: string;
  readonly subgroup: string;
  /** The lanes of `= constant`, converted to the type, or nothing for no default. */
  readonly defaultValue?: readonly Scalar[];
  /** The rows of `global`, `instance`, `uniform` and each hint, filter and repeat word. */
  readonly rows: readonly InstructionRow[];
  readonly position: SourcePosition;
}

/** NODE_TYPE_SHADER: its structs and functions, each in the order of the text. */
/** A name of a `render_mode` or `stencil_mode` statement, as the text writes it. */
export interface ShaderModeNode {
  readonly name: string;
  readonly position: SourcePosition;
}

/** `varying flat vec2 cell[3];` (`shader_language.cpp:9531`). */
export interface VaryingNode {
  readonly kind: 'varying';
  readonly name: string;
  readonly type: ValueType;
  readonly interpolation?: 'flat' | 'smooth';
  readonly arraySize?: number;
  readonly position: SourcePosition;
}

export interface ShaderNode {
  readonly kind: 'shader';
  /** The type `shader_type` names: `sky`, `spatial`. Nothing for a text with no head, as a probe's. */
  readonly shaderType?: string;
  /** Where the `shader_type` head is, when the text has one. */
  readonly headPosition?: SourcePosition;
  readonly renderModes: readonly ShaderModeNode[];
  readonly stencilModes: readonly ShaderModeNode[];
  /** The integer of a `stencil_mode` statement, 0 to 255. */
  readonly stencilReference?: number;
  readonly varyings: readonly VaryingNode[];
  /** Each `const` outside a function, in the order of the text. */
  readonly constants: readonly DeclarationNode[];
  readonly structs: readonly StructNode[];
  readonly uniforms: readonly UniformNode[];
  /** Each `group_uniforms` statement, which only names the inspector's group of the uniforms after it. */
  readonly uniformGroups: readonly { readonly position: SourcePosition }[];
  readonly functions: readonly FunctionNode[];
}
