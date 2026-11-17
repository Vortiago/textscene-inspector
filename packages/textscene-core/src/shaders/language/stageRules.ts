/**
 * Godot's rules of the processor functions: the signature of each, `return` and `discard` in them,
 * the stage functions, and what `vertex` may not reach through the functions it calls.
 */
import {
  FRAGMENT_ONLY_FUNCTIONS,
  INSTRUCTION_TABLE,
  type InstructionRow,
  SHADER_STAGES,
  type ShaderStage,
} from './instructionTable.generated.js';
import type { CallNode, Expression, ValueType } from './shaderTree.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { TokenCursor } from './tokenCursor.js';

/** A use that `vertex` may not reach, `CallInfo::Item`, with the place Godot names when it refuses it. */
interface RestrictedUse {
  readonly name: string;
  readonly isVarying: boolean;
  readonly mark: number;
}

/** `CallInfo` (`shader_language.h:991`): a function's restricted uses and the functions it calls. */
interface CallInfo {
  readonly name: string;
  readonly uses: RestrictedUse[];
  readonly calls: CallInfo[];
}

/** What the rules read from the shader parser. */
export interface StageContext {
  shaderType(): string | undefined;
  /** Godot's name of the function whose body is read, `f@2` for the second `f`. */
  currentFunction(): string | undefined;
  /** The stage a varying is assigned in so far: `vertex`, `fragment`, or nothing. */
  varyingStage(name: string): string | undefined;
}

export class StageRules {
  /** Written only by `begin`, `current` and the uses: an entry for each function declared so far. */
  private readonly calls = new Map<string, CallInfo>();

  constructor(
    private readonly tokens: TokenCursor,
    private readonly context: StageContext
  ) {}

  /** The key `name` is in the shader type's functions: a stage, `global` or `constants`. */
  stage(name: string): ShaderStage | undefined {
    const shaderType = this.shaderTypeName();
    return SHADER_STAGES.find((stage) => stage.shaderType === shaderType && stage.stage === name);
  }

  /** `void name()` for a processor function (`shader_language.cpp:10981`). */
  checkSignature(name: string, argumentCount: number, returnType: ValueType): void {
    if (!this.stage(name)) return;
    if (argumentCount > 0) this.tokens.fail(`Function '${name}' expects no arguments.`);
    if (returnType !== 'void') this.tokens.fail(`Function '${name}' must be of 'void' return type.`);
  }

  /** A function's `CallInfo`, made at its `{` (`shader_language.cpp:10973`). */
  begin(name: string): void {
    this.calls.set(name, { name, uses: [], calls: [] });
  }

  /** Godot refuses `return` anywhere in a processor function (`shader_language.cpp:8865`). */
  checkReturn(): void {
    const current = this.current();
    if (this.stage(current.name)?.isMain)
      this.tokens.fail(`Using 'return' in the '${current.name}' processor function is incorrect.`);
  }

  /** `discard` after its token, before its `;` (`shader_language.cpp:8936`). */
  discard(): void {
    if (!this.isDiscardSupported())
      this.tokens.fail(`Use of 'discard' is not supported for the '${this.shaderTypeName()}' shader type.`);
    const current = this.current();
    const stage = this.stage(current.name);
    if (!(stage ? stage.canDiscard : this.isDiscardSupported()))
      this.tokens.fail(`'discard' cannot be used within the '${current.name}' processor function.`);
    this.use('discard', false);
  }

  /** A read or a write of a varying, after its name (`shader_language.cpp:6607`). */
  useVarying(name: string): void {
    this.use(name, true);
  }

  /**
   * A call of `target`, Godot's name of the function called, after its arguments and before Godot
   * matches them (`shader_language.cpp:6280`).
   */
  call(target: string): void {
    const current = this.current();
    if (target === current.name) return;
    const callee = this.calls.get(target);
    if (callee) current.calls.push(callee);
    const supportsFragmentOnly = this.supportsFragmentOnly();
    let isBuiltIn = false;
    if (supportsFragmentOnly && this.stageFunctionRow(target)) {
      this.use(target, false);
      isBuiltIn = true;
    }
    if (!isBuiltIn && FRAGMENT_ONLY_FUNCTIONS.includes(target)) {
      if (!supportsFragmentOnly)
        this.tokens.fail(
          `Built-in function '${target}' is not supported for the '${this.shaderTypeName()}' shader type.`
        );
      this.use(target, false);
      isBuiltIn = true;
    }
    if (supportsFragmentOnly && current.name === 'vertex' && this.stage('vertex'))
      this.checkRestricted(target, current, isBuiltIn);
  }

  /** A call of a stage function, `emit_subparticle`, of any stage of the type (`shader_language.cpp:3594`). */
  stageCall(name: string, args: readonly Expression[], position: SourcePosition): CallNode | undefined {
    const row = this.stageFunctionRow(name);
    if (!row) return undefined;
    const expected = row.args!;
    if (args.length !== expected.length)
      this.tokens.fail(
        `Invalid number of arguments when calling stage function '${name}', which expects ${expected.length} argument(s).`
      );
    const misfit = expected.findIndex((type, index) => args[index]!.type !== type);
    if (misfit !== -1)
      this.tokens.fail(
        `Invalid argument type when calling stage function '${name}', type expected is '${expected[misfit]}'.`
      );
    return {
      kind: 'operator',
      op: 'OP_CALL',
      row,
      function: name,
      rname: name,
      qualifiers: args.map(() => 'in'),
      type: row.returns!,
      operands: args,
      position,
    };
  }

  /** Whether `name` is a stage function of the function whose body is read (`shader_language.cpp:1413`). */
  isStageFunctionHere(name: string): boolean {
    const current = this.context.currentFunction();
    return current !== undefined && stageFunctionRows(this.shaderTypeName(), current, name).length > 0;
  }

  /** `_validate_restricted_func` (`shader_language.cpp:5490`): the first restricted use `vertex` reaches. */
  private checkRestricted(name: string, info: CallInfo, isBuiltIn = false): void {
    const isVertex = info.name === 'vertex';
    if (!isBuiltIn)
      for (const callee of info.calls)
        if (!isVertex || callee.name === name) this.checkRestricted(name, callee);
    const [first] = info.uses;
    if (!first) return;
    if (first.isVarying && this.context.varyingStage(first.name) === 'vertex') return;
    this.tokens.reset(first.mark);
    this.tokens.fail(
      isVertex
        ? `'${first.name}' cannot be used within the 'vertex' processor function.`
        : `'${first.name}' cannot be used here, because '${info.name}' is called by the 'vertex' processor function (which is not allowed).`
    );
  }

  /** The first row of a stage function of that name, in the order of the type's stages. */
  private stageFunctionRow(name: string): InstructionRow | undefined {
    const shaderType = this.shaderTypeName();
    for (const { stage } of SHADER_STAGES.filter((each) => each.shaderType === shaderType)) {
      const [row] = stageFunctionRows(shaderType, stage, name);
      if (row) return row;
    }
    return undefined;
  }

  private use(name: string, isVarying: boolean): void {
    this.current().uses.push({ name, isVarying, mark: this.tokens.mark() });
  }

  /** Outside a function, the entry of the empty name, which Godot's \`calls_info[current_function]\` makes. */
  private current(): CallInfo {
    const name = this.context.currentFunction() ?? '';
    if (!this.calls.has(name)) this.begin(name);
    return this.calls.get(name)!;
  }

  /** A text with no head is a probe's, which Godot draws as a `canvas_item`. */
  private shaderTypeName(): string {
    return this.context.shaderType() ?? 'canvas_item';
  }

  /** `is_discard_supported` (`shader_language.cpp:9228`). */
  private isDiscardSupported(): boolean {
    return /^(canvas_item|spatial)$/.test(this.shaderTypeName());
  }

  /** `is_supported_frag_only_funcs` (`shader_language.cpp:9229`). */
  private supportsFragmentOnly(): boolean {
    return this.isDiscardSupported() || this.shaderTypeName() === 'sky';
  }
}

const STAGE_FUNCTION_ROWS = INSTRUCTION_TABLE.filter((row) => row.family === 'stage function');

const stageFunctionRows = (shaderType: string, stage: string, name: string) =>
  STAGE_FUNCTION_ROWS.filter((row) => row.id.startsWith(`${shaderType}.${stage}.${name}(`));
