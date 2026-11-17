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
  /** `canvas_item` for a text with no head, which is how Godot draws a probe. */
  shaderType(): string;
  /** Godot's name of the function whose body is read, `f@2` for the second `f`. */
  currentFunction(): string | undefined;
  /** The stage a varying is assigned in so far: `vertex`, `fragment`, or nothing. */
  varyingStage(name: string): string | undefined;
}

/** Godot's rules of the processor functions, and what `vertex()` may reach through its calls. */
export class StageRules {
  /** Written only by `begin`, `current` and the uses: an entry for each function declared so far. */
  private readonly calls = new Map<string, CallInfo>();

  constructor(
    private readonly tokens: TokenCursor,
    private readonly context: StageContext
  ) {}

  /** The key `name` is in the shader type's functions: a stage, `global` or `constants`. */
  stage(name: string): ShaderStage | undefined {
    return STAGES.get(`${this.context.shaderType()}.${name}`);
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
      this.tokens.fail(
        `Use of 'discard' is not supported for the '${this.context.shaderType()}' shader type.`
      );
    const current = this.current();
    if (this.stage(current.name)?.canDiscard === false)
      this.tokens.fail(`'discard' cannot be used within the '${current.name}' processor function.`);
    this.use('discard', false);
  }

  /** A read or a write of a varying, after its name (`shader_language.cpp:6607`). */
  useVarying(name: string): void {
    this.use(name, true);
  }

  /** A call of `target`, Godot's name of the callee, before Godot matches its arguments (:6280). */
  call(target: string): void {
    const current = this.current();
    if (target === current.name) return;
    const callee = this.calls.get(target);
    if (callee) current.calls.push(callee);
    const supportsFragmentOnly = this.supportsFragmentOnly();
    const isStageFunction = supportsFragmentOnly && this.stageFunctionRow(target) !== undefined;
    const isBuiltIn = isStageFunction || FRAGMENT_ONLY_FUNCTIONS.includes(target);
    if (isBuiltIn && !supportsFragmentOnly)
      this.tokens.fail(
        `Built-in function '${target}' is not supported for the '${this.context.shaderType()}' shader type.`
      );
    if (isBuiltIn) this.use(target, false);
    if (supportsFragmentOnly && current.name === 'vertex' && this.stage('vertex'))
      this.checkRestricted(target, current, isBuiltIn);
  }

  /** A call of a stage function, `emit_subparticle`, of any stage of the type (:3594). */
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
    return (
      current !== undefined && STAGE_FUNCTION_KEYS.has(`${this.context.shaderType()}.${current}.${name}`)
    );
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
    return FIRST_STAGE_FUNCTION_ROWS.get(`${this.context.shaderType()}.${name}`);
  }

  private use(name: string, isVarying: boolean): void {
    this.current().uses.push({ name, isVarying, mark: this.tokens.mark() });
  }

  /** Outside a function, the entry of the empty name, as `calls_info[current_function]` makes it. */
  private current(): CallInfo {
    const name = this.context.currentFunction() ?? '';
    if (!this.calls.has(name)) this.begin(name);
    return this.calls.get(name)!;
  }

  /** `is_discard_supported` (`shader_language.cpp:9228`). */
  private isDiscardSupported(): boolean {
    return DISCARD_TYPES.has(this.context.shaderType());
  }

  /** `is_supported_frag_only_funcs` (`shader_language.cpp:9229`). */
  private supportsFragmentOnly(): boolean {
    return FRAGMENT_ONLY_TYPES.has(this.context.shaderType());
  }
}

const DISCARD_TYPES: ReadonlySet<string> = new Set(['canvas_item', 'spatial']);
const FRAGMENT_ONLY_TYPES: ReadonlySet<string> = new Set([...DISCARD_TYPES, 'sky']);

const STAGES = new Map(SHADER_STAGES.map((stage) => [`${stage.shaderType}.${stage.stage}`, stage]));

/** The id of a stage function row up to its `(`: `canvas_item.fragment.texture_sdf`. */
const stageFunctionKey = (row: InstructionRow) => row.id.slice(0, row.id.indexOf('('));

const STAGE_FUNCTION_ROWS = INSTRUCTION_TABLE.filter((row) => row.family === 'stage function');

const STAGE_FUNCTION_KEYS: ReadonlySet<string> = new Set(STAGE_FUNCTION_ROWS.map(stageFunctionKey));

/** The first row of each stage function name of a shader type, in the order of the type's stages. */
const FIRST_STAGE_FUNCTION_ROWS = new Map<string, InstructionRow>();
for (const { shaderType, stage } of SHADER_STAGES)
  for (const row of STAGE_FUNCTION_ROWS.filter((each) =>
    stageFunctionKey(each).startsWith(`${shaderType}.${stage}.`)
  )) {
    const key = `${shaderType}.${row.id.slice(`${shaderType}.${stage}.`.length, row.id.indexOf('('))}`;
    if (!FIRST_STAGE_FUNCTION_ROWS.has(key)) FIRST_STAGE_FUNCTION_ROWS.set(key, row);
  }
