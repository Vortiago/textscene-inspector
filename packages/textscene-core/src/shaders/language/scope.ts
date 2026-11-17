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
      readonly isConst: boolean;
    }
  | { readonly kind: 'function' }
  | ({ readonly kind: 'constant' } & LocalVariable)
  | {
      readonly kind: 'varying';
      readonly type: ValueType;
      readonly arraySize: number;
      readonly isConst: false;
    }
  | {
      readonly kind: 'uniform';
      readonly type: ValueType;
      readonly arraySize: number;
      readonly isConst: false;
    }
  | {
      readonly kind: 'built-in';
      readonly type: ValueType;
      readonly arraySize: number;
      /** A read-only built-in: Godot refuses a write to it. */
      readonly isConst: boolean;
      readonly row: string;
    };

/** The shader's names outside every function, which each block sees past its own. */
export type GlobalNames = ReadonlyMap<string, Identifier>;

const NO_GLOBALS: GlobalNames = new Map();

/** A lookup reaches the arguments only through the body, the block with `functionArguments`. */
export class BlockScope {
  readonly variables = new Map<string, LocalVariable>();
  /** The globals of the body, which each block inside it shares. */
  private readonly globals: GlobalNames;

  constructor(
    readonly parent: BlockScope | undefined,
    readonly kind: BlockKind,
    readonly functionArguments?: readonly Argument[],
    globals?: GlobalNames
  ) {
    this.globals = globals ?? parent?.globals ?? NO_GLOBALS;
  }

  /** Godot's `p_allow_reassign`: a declaration may hide an outer local, not an argument or a uniform. */
  find(name: string, ownBlockOnly: boolean): Identifier | undefined {
    const local = this.variables.get(name);
    if (local) return { kind: 'local', ...local };
    if (this.functionArguments) return argumentNamed(this.functionArguments, name) ?? this.globals.get(name);
    return ownBlockOnly ? this.globals.get(name) : this.parent?.find(name, false);
  }

  /** The local variable `name` of this block or a block around it, never an argument. */
  findLocal(name: string): LocalVariable | undefined {
    return this.variables.get(name) ?? this.parent?.findLocal(name);
  }

  /** Whether a block from this one out to the function's body is of `kind`. */
  isInside(kind: BlockKind): boolean {
    return this.kind === kind || (this.parent?.isInside(kind) ?? false);
  }
}

function argumentNamed(args: readonly Argument[], name: string): Identifier | undefined {
  const argument = args.find((candidate) => candidate.name === name);
  if (!argument) return undefined;
  return {
    kind: 'argument',
    type: argument.type,
    arraySize: argument.arraySize ?? 0,
    isConst: argument.isConst ?? false,
  };
}
