/**
 * The names a statement sees, as Godot's chain of `BlockNode`s holds them: each block's
 * variables, then the function's arguments, then the shader's functions
 * (`_find_identifier`, `shader_language.cpp:1377`).
 */

import type { Argument, Scalar, ValueType } from './shaderTree.js';

/** The kind of a block, as Godot's `BlockNode::BlockType` names the ones the parser tells apart. */
export type BlockKind = 'plain' | 'switch' | 'case' | 'default' | 'for init' | 'for condition' | 'for step';

/** A local variable: its type, its array size, and a `const` local's folded lanes. */
export interface LocalVariable {
  readonly type: ValueType;
  readonly arraySize: number;
  readonly isConst: boolean;
  readonly values?: readonly Scalar[];
}

/** What a name stands for where it is read. */
export type Identifier =
  | ({ readonly kind: 'local' } & LocalVariable)
  | {
      readonly kind: 'argument';
      readonly type: ValueType;
      readonly arraySize: number;
      readonly isConst: false;
    }
  | { readonly kind: 'function' };

/**
 * A block and its variables. The function's body is the block whose `functionArguments` are set:
 * a lookup reaches the arguments only through it.
 */
export class BlockScope {
  readonly variables = new Map<string, LocalVariable>();
  /** The labels of a `switch` block's cases so far, as Godot's `BlockNode::constants`. */
  readonly labels = new Set<number>();

  constructor(
    readonly parent: BlockScope | undefined,
    readonly kind: BlockKind,
    readonly functionArguments?: readonly Argument[]
  ) {}

  /**
   * What `name` stands for. With `ownBlockOnly`, Godot's `p_allow_reassign`, a lookup reads this
   * block alone, and the arguments only when this block is the body: a declaration may hide a
   * name of an outer block, but not an argument in the body.
   */
  find(name: string, ownBlockOnly: boolean): Identifier | undefined {
    const local = this.variables.get(name);
    if (local) return { kind: 'local', ...local };
    if (this.functionArguments) return argumentNamed(this.functionArguments, name);
    return ownBlockOnly ? undefined : this.parent?.find(name, false);
  }

  /** Whether a block from this one out to the function's body is of `kind`. */
  isInside(kind: BlockKind): boolean {
    return this.kind === kind || (this.parent?.isInside(kind) ?? false);
  }
}

function argumentNamed(args: readonly Argument[], name: string): Identifier | undefined {
  const argument = args.find((candidate) => candidate.name === name);
  if (!argument) return undefined;
  return { kind: 'argument', type: argument.type, arraySize: 0, isConst: false };
}
