/**
 * The tree of one stage of a template variant: the shading language's tree (`shaderTree.ts`) with
 * what GLSL 4.50 adds outside a function: layout qualifiers, interface blocks, globals, default
 * layouts, precision statements, function prototypes, the kept directives and the slots where a
 * material's tree goes.
 */

import type { SourcePosition } from '../language/shadingLanguageError.js';
import type { Expression, FunctionNode, StructMember, StructNode } from '../language/shaderTree.js';
import type { KeptDirective } from './preprocess.js';
import type { StageName } from './stages.js';
import type { Slot } from './variant.js';

/** One entry of `layout(...)`: `binding = 2`, `std430`, `push_constant`. */
export interface LayoutEntry {
  readonly name: string;
  readonly value?: Expression;
}

/**
 * The qualifiers before a global's type, in the order of the text: storage (`uniform`, `buffer`,
 * `in`, `out`, `shared`, `const`), memory (`restrict`, `readonly`, ...), interpolation (`flat`),
 * precision and `invariant`.
 */
export interface GlobalQualifiers {
  readonly layout: readonly LayoutEntry[];
  readonly words: readonly string[];
}

/** A member of an interface block, with its own qualifiers: `layout(offset = 0) highp vec4 a[];`. */
export interface BlockMember extends StructMember {
  readonly kind: 'block member';
  readonly qualifiers: GlobalQualifiers;
  /** An array of no size, the last member of a `buffer` block: `vec4 data[]`. */
  readonly isRuntimeSized?: boolean;
  readonly position: SourcePosition;
}

/** `layout(...) uniform Name { members } instance[n];` */
export interface InterfaceBlockNode {
  readonly kind: 'interface block';
  readonly qualifiers: GlobalQualifiers;
  readonly blockName: string;
  readonly members: readonly (BlockMember | SlotNode)[];
  /** The instance name, or nothing for a block whose members are globals. */
  readonly instanceName?: string;
  readonly arraySize?: number;
  readonly position: SourcePosition;
}

/** One name of a global, with its array size and value. */
export interface GlobalDeclarator {
  readonly name: string;
  readonly arraySize?: number;
  readonly isRuntimeSized?: boolean;
  readonly value?: Expression;
  readonly position: SourcePosition;
}

/** A global variable: `layout(location = 0) out vec4 frag_color;`, `shared float data[64];`. */
export interface GlobalNode {
  readonly kind: 'global';
  readonly qualifiers: GlobalQualifiers;
  readonly type: string;
  readonly declarators: readonly GlobalDeclarator[];
  readonly position: SourcePosition;
}

/** A layout with no declaration: `layout(local_size_x = 8, local_size_y = 8) in;`. */
export interface DefaultLayoutNode {
  readonly kind: 'default layout';
  readonly qualifiers: GlobalQualifiers;
  readonly position: SourcePosition;
}

/** `invariant gl_Position;` */
export interface InvariantNode {
  readonly kind: 'invariant';
  readonly names: readonly string[];
  readonly position: SourcePosition;
}

/** `precision highp float;` */
export interface PrecisionNode {
  readonly kind: 'precision';
  readonly precision: string;
  readonly type: string;
  readonly position: SourcePosition;
}

/** A function declared before its body: `vec3 f(vec2 a);`. */
export interface PrototypeNode {
  readonly kind: 'prototype';
  readonly function: Omit<FunctionNode, 'body' | 'kind'>;
  readonly position: SourcePosition;
}

/** Where a material's tree goes: its globals, its uniforms, or the body of one stage function. */
export interface SlotNode {
  readonly kind: 'slot';
  readonly slot: Slot;
  readonly position: SourcePosition;
}

export type TemplateDeclaration =
  | InterfaceBlockNode
  | GlobalNode
  | DefaultLayoutNode
  | PrecisionNode
  | InvariantNode
  | PrototypeNode
  | StructNode
  | FunctionNode
  | SlotNode;

/** One stage of one variant: its directives and its declarations in the order of the text. */
export interface TemplateStageNode {
  readonly kind: 'template stage';
  readonly stage: StageName;
  readonly directives: readonly KeptDirective[];
  readonly declarations: readonly TemplateDeclaration[];
}
