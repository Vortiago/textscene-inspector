import { convertedScalar } from './constants.js';
import { instruction, keywordInstruction } from './instructions.js';
import type { InstructionRow } from './instructionTable.generated.js';
import type { ExpressionParser } from './parseExpression.js';
import type { RenderingMethod } from '../preprocessor/preprocessor.js';
import type { Identifier } from './scope.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { Scalar, UniformHint, UniformNode, UniformScope, ValueType } from './shaderTree.js';
import type { TokenCursor } from './tokenCursor.js';
import { isIntegerConstant, isPrecisionToken, type Token } from './tokenizer.js';
import { shapeOf } from './types.js';

/** `MAX_INSTANCE_UNIFORM_INDICES` (`shader_language.h:348`). */
const INSTANCE_INDICES = 16;

/** The hint each hint word sets, by its token. `instance_index` and the sampler settings set none. */
const HINT_OF_TOKEN: Readonly<Record<string, UniformHint>> = {
  TK_HINT_DEFAULT_BLACK_TEXTURE: 'hint_default_black',
  TK_HINT_DEFAULT_WHITE_TEXTURE: 'hint_default_white',
  TK_HINT_DEFAULT_TRANSPARENT_TEXTURE: 'hint_default_transparent',
  TK_HINT_NORMAL_TEXTURE: 'hint_normal',
  TK_HINT_ROUGHNESS_NORMAL_TEXTURE: 'hint_roughness_normal',
  TK_HINT_ROUGHNESS_R: 'hint_roughness_r',
  TK_HINT_ROUGHNESS_G: 'hint_roughness_g',
  TK_HINT_ROUGHNESS_B: 'hint_roughness_b',
  TK_HINT_ROUGHNESS_A: 'hint_roughness_a',
  TK_HINT_ROUGHNESS_GRAY: 'hint_roughness_gray',
  TK_HINT_ANISOTROPY_TEXTURE: 'hint_anisotropy',
  TK_HINT_SCREEN_TEXTURE: 'hint_screen_texture',
  TK_HINT_NORMAL_ROUGHNESS_TEXTURE: 'hint_normal_roughness_texture',
  TK_HINT_DEPTH_TEXTURE: 'hint_depth_texture',
};

/** The hints of a value, not of a sampler (`shader_language.cpp:10061`). */
const VALUE_HINTS: ReadonlySet<UniformHint> = new Set([
  'none',
  'source_color',
  'color_conversion_disabled',
  'hint_range',
  'hint_enum',
]);

/** The words an array takes after `:` (`shader_language.cpp:9802`). */
const ARRAY_WORDS: ReadonlySet<string> = new Set([
  'TK_HINT_SOURCE_COLOR',
  'TK_HINT_COLOR_CONVERSION_DISABLED',
  'TK_REPEAT_DISABLE',
  'TK_REPEAT_ENABLE',
  'TK_FILTER_LINEAR',
  'TK_FILTER_LINEAR_MIPMAP',
  'TK_FILTER_LINEAR_MIPMAP_ANISOTROPIC',
  'TK_FILTER_NEAREST',
  'TK_FILTER_NEAREST_MIPMAP',
  'TK_FILTER_NEAREST_MIPMAP_ANISOTROPIC',
]);

/** What the uniform parser asks of the shader parser around it. */
export interface UniformContext {
  readonly shaderType: () => string | undefined;
  readonly renderingMethod: RenderingMethod;
  readonly isStruct: (name: string) => boolean;
  /** Whether a function, a uniform or a built-in has the name already. */
  readonly isTaken: (name: string) => boolean;
  /** The shader's names outside every function, where each uniform's name goes. */
  readonly globals: Map<string, Identifier>;
}

/** A uniform as the hint loop fills it. */
interface Draft {
  hint: UniformHint;
  usesColor: boolean;
  filter?: string;
  repeat?: string;
  range: [number, number, number];
  enumNames: string[];
  instanceIndex?: number;
  readonly rows: InstructionRow[];
}

/** The uniforms of a shader and its `group_uniforms` (`shader_language.cpp:9488-10252`). */
export class UniformParser {
  readonly uniforms: UniformNode[] = [];
  readonly groups: { readonly position: SourcePosition }[] = [];
  /** Written only by `groupStatement`. */
  private group = '';
  private subgroup = '';
  /** The next `instance` uniform's index, written only by `instanceIndexOf`. */
  private nextInstanceIndex = 0;

  constructor(
    private readonly tokens: TokenCursor,
    private readonly expressions: ExpressionParser,
    private readonly context: UniformContext
  ) {}

  uniform(name: string): UniformNode | undefined {
    return this.uniforms.find((uniform) => uniform.name === name);
  }

  /** `global uniform`, `instance uniform` or `uniform`, read from its first word. */
  declaration(first: Token): void {
    const scope = this.scopeOf(first);
    const firstRow = keywordInstruction(first.type)!;
    const rows = [firstRow];
    if (scope !== 'local') {
      if (this.tokens.next().type !== 'TK_UNIFORM')
        this.tokens.fail(`Expected a 'uniform' after '${firstRow.id}'.`);
      rows.push(instruction('uniform')!);
    }
    const typeToken = this.uniformType();
    const type = keywordInstruction(typeToken.type)!.id;
    let token = this.tokens.next();
    if (token.type !== 'TK_IDENTIFIER' && token.type !== 'TK_BRACKET_OPEN')
      this.tokens.fail("Expected an identifier or '['.");
    let arraySize = 0;
    if (token.type === 'TK_BRACKET_OPEN') {
      arraySize = this.expressions.arrays.size(true)!;
      token = this.tokens.next();
    }
    if (token.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an identifier.');
    const name = token.text!;
    if (this.context.isTaken(name)) this.tokens.fail(`Redefinition of '${name}'.`);
    token = this.tokens.next();
    if (token.type === 'TK_BRACKET_OPEN') {
      if (arraySize > 0) this.tokens.fail('Array size is already defined.');
      arraySize = this.expressions.arrays.size(true)!;
      token = this.tokens.next();
    }
    this.refuseScope(scope, type, arraySize);
    const draft: Draft = {
      hint: 'none',
      usesColor: false,
      range: [0, 1, Math.fround(0.001)],
      enumNames: [],
      rows,
    };
    if (token.type === 'TK_COLON') token = this.hints(draft, type, arraySize);
    // Godot keeps `instance_index` on a uniform of any scope, and counts only an `instance` one.
    const instanceIndex = scope === 'instance' ? this.instanceIndexOf(draft) : draft.instanceIndex;
    const defaultValue = token.type === 'TK_OP_ASSIGN' ? this.defaultValue(type, arraySize) : undefined;
    if (defaultValue) token = this.tokens.next();
    const header = { name, type, arraySize, scope, instanceIndex, defaultValue };
    this.uniforms.push(uniformNode(draft, header, this.group, this.subgroup, first.position));
    this.context.globals.set(name, { kind: 'uniform', type, arraySize, isConst: false });
    if (token.type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ';'.");
  }

  /** `group_uniforms name;`, `group_uniforms name.sub;` or `group_uniforms;` (:10213). */
  groupStatement(first: Token): void {
    this.groups.push({ position: first.position });
    let token = this.tokens.next();
    if (token.type !== 'TK_IDENTIFIER') return this.closeGroup(token);
    this.group = token.text!;
    this.subgroup = '';
    token = this.tokens.next();
    if (token.type === 'TK_PERIOD') {
      token = this.tokens.next();
      if (token.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an uniform subgroup identifier.');
      this.subgroup = token.text!;
      if (this.tokens.next().type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ';'.");
    } else if (token.type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ';' or '.'.");
  }

  private closeGroup(token: Token): void {
    if (token.type !== 'TK_SEMICOLON')
      this.tokens.fail(
        this.group === ''
          ? 'Expected an uniform group identifier.'
          : 'Expected an uniform group identifier or `;`.'
      );
    if (this.group === '') this.tokens.fail('Group needs to be opened before.');
    this.group = '';
    this.subgroup = '';
  }

  /** The scope `first` names. Godot refuses `instance` outside `spatial` and `canvas_item` (:9505). */
  private scopeOf(first: Token): UniformScope {
    if (first.type === 'TK_GLOBAL') return 'global';
    if (first.type !== 'TK_INSTANCE') return 'local';
    const shaderType = this.context.shaderType();
    if (shaderType !== undefined && shaderType !== 'spatial' && shaderType !== 'canvas_item')
      this.tokens.fail(`Uniform instances are not yet implemented for '${shaderType}' shaders.`);
    return 'instance';
  }

  /** The type token after an optional precision, which Godot checks in this order (:9567). */
  private uniformType(): Token {
    let token = this.tokens.next();
    if (token.type === 'TK_INTERPOLATION_FLAT' || token.type === 'TK_INTERPOLATION_SMOOTH')
      this.tokens.fail('Interpolation qualifiers are not supported for uniforms.');
    const hasPrecision = isPrecisionToken(token);
    if (hasPrecision) token = this.tokens.next();
    if (token.type === 'TK_IDENTIFIER' && this.context.isStruct(token.text!))
      this.tokens.fail("The 'struct' data type is not supported for uniforms.");
    const row = keywordInstruction(token.type);
    if (row?.family !== 'data type' || row.id === 'struct type') this.tokens.fail('Expected data type.');
    if (hasPrecision && shapeOf(row.id)?.scalar === 'bool')
      this.tokens.fail('The precision modifier cannot be used on boolean types.');
    if (row.id === 'void') this.tokens.fail("The 'void' data type is not allowed here.");
    return token;
  }

  /** Samplers and matrices are no `instance` uniform, and an array is neither `global` nor `instance`. */
  private refuseScope(scope: UniformScope, type: ValueType, arraySize: number): void {
    const isSampler = shapeOf(type) === undefined;
    if (scope === 'instance' && isSampler)
      this.tokens.fail("The 'SCOPE_INSTANCE' qualifier is not supported for sampler types.");
    if (scope === 'instance' && shapeOf(type)?.columns !== undefined)
      this.tokens.fail("The 'SCOPE_INSTANCE' qualifier is not supported for matrix types.");
    if (arraySize > 0 && scope !== 'local')
      this.tokens.fail(
        `The '${scope === 'global' ? 'SCOPE_GLOBAL' : 'SCOPE_INSTANCE'}' qualifier is not supported for uniform arrays.`
      );
  }

  /** The words after `:`, each once, and the token after the last (`shader_language.cpp:9787`). */
  private hints(draft: Draft, type: ValueType, arraySize: number): Token {
    let token: Token;
    do {
      token = this.tokens.next();
      const row = keywordInstruction(token.type);
      if (row?.family !== 'uniform hint' && row?.family !== 'sampler setting')
        this.tokens.fail("Expected valid type hint after ':'.");
      if (arraySize > 0 && !ARRAY_WORDS.has(token.type))
        this.tokens.fail('This hint is not supported for uniform arrays.');
      draft.rows.push(row);
      this.hintWord(draft, token, type);
      token = this.tokens.next();
    } while (token.type === 'TK_COMMA');
    return token;
  }

  private hintWord(draft: Draft, token: Token, type: ValueType): void {
    const isSampler = shapeOf(type) === undefined;
    const row = keywordInstruction(token.type)!;
    const setting = row.family === 'sampler setting' ? row.id : undefined;
    const hint = this.hintOf(draft, token, type);
    if ((setting !== undefined || !VALUE_HINTS.has(hint)) && !isSampler)
      this.tokens.fail('This hint is only for sampler types.');
    if (hint !== 'none') setHint(draft, hint, this.tokens);
    if (setting?.startsWith('filter_')) draft.filter = setOnce(draft.filter, setting, 'filter', this.tokens);
    if (setting?.startsWith('repeat_')) draft.repeat = setOnce(draft.repeat, setting, 'repeat', this.tokens);
  }

  /** The hint the word sets, after the checks Godot makes as it reads the word (:9818-10046). */
  private hintOf(draft: Draft, token: Token, type: ValueType): UniformHint {
    const isColor = type === 'vec3' || type === 'vec4';
    switch (token.type) {
      case 'TK_HINT_SOURCE_COLOR':
        if (!isColor && shapeOf(type) !== undefined)
          this.tokens.fail("Source color hint is for 'vec3', 'vec4' or sampler types only.");
        if (isColor) return 'source_color';
        if (draft.usesColor) this.tokens.fail("Duplicated hint: 'source_color'.");
        draft.usesColor = true;
        return 'none';
      case 'TK_HINT_COLOR_CONVERSION_DISABLED':
        if (!isColor) this.tokens.fail("Source color conversion disabled hint is for 'vec3', 'vec4'.");
        if (draft.hint !== 'source_color')
          this.tokens.fail("Hint 'color_conversion_disabled' should be preceded by 'source_color'.");
        draft.hint = 'none';
        return 'color_conversion_disabled';
      case 'TK_HINT_RANGE':
        this.rangeHint(draft, type);
        return 'hint_range';
      case 'TK_HINT_ENUM':
        this.enumHint(draft, type);
        return 'hint_enum';
      case 'TK_HINT_INSTANCE_INDEX':
        this.instanceIndexHint(draft);
        return 'none';
      case 'TK_HINT_NORMAL_ROUGHNESS_TEXTURE':
        if (this.context.renderingMethod !== 'forward_plus')
          this.tokens.fail(
            "'hint_normal_roughness_texture' is only available when using the Forward+ renderer."
          );
        this.refuseOutsideSpatial('hint_normal_roughness_texture');
        return 'hint_normal_roughness_texture';
      case 'TK_HINT_DEPTH_TEXTURE':
        this.refuseOutsideSpatial('hint_depth_texture');
        return 'hint_depth_texture';
      default:
        return HINT_OF_TOKEN[token.type] ?? 'none';
    }
  }

  private refuseOutsideSpatial(word: string): void {
    const shaderType = this.context.shaderType();
    if (shaderType !== undefined && shaderType !== 'spatial')
      this.tokens.fail(`'${word}' is not supported in '${shaderType}' shaders.`);
  }

  /** `hint_range(min, max[, step])`, the step 1 for `int` and 0.001 for `float` (:9880). */
  private rangeHint(draft: Draft, type: ValueType): void {
    if (type !== 'float' && type !== 'int') this.tokens.fail("Range hint is for 'float' and 'int' only.");
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN')
      this.tokens.fail("Expected a '(' after 'hint_range'.");
    const min = this.numericConstant('Expected a valid numeric expression.');
    if (this.tokens.next().type !== 'TK_COMMA') this.tokens.fail("Expected a ','.");
    const max = this.numericConstant("Expected a valid numeric expression after ','.");
    let token = this.tokens.next();
    let step = type === 'int' ? 1 : Math.fround(0.001);
    if (token.type === 'TK_COMMA') {
      step = this.numericConstant("Expected a valid numeric expression after ','.");
      token = this.tokens.next();
    }
    if (token.type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ')'.");
    draft.range = [min, max, step];
  }

  /** `_parse_numeric_constant_expression` (`shader_language.cpp:9136`): a `float`, `int` or `uint`. */
  private numericConstant(message: string): number {
    const value = this.expressions.expression();
    if (value.kind !== 'constant' || !['float', 'int', 'uint'].includes(value.type))
      this.tokens.fail(message);
    return Math.fround(value.values[0] as number);
  }

  /** `hint_enum("a", "b")`, for an `int` only (:9932). */
  private enumHint(draft: Draft, type: ValueType): void {
    if (type !== 'int') this.tokens.fail("Enum hint is for 'int' only.");
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN')
      this.tokens.fail("Expected a '(' after 'hint_enum'.");
    for (;;) {
      const token = this.tokens.next();
      if (token.type !== 'TK_STRING_CONSTANT') this.tokens.fail('Expected a string constant.');
      draft.enumNames.push(token.text!);
      const end = this.tokens.next();
      if (end.type === 'TK_PARENTHESIS_CLOSE') return;
      if (end.type !== 'TK_COMMA') this.tokens.fail("Expected ',' or ')' after string constant.");
    }
  }

  /** `instance_index(n)`, once, with `n` an integer constant under 16 (:9966). */
  private instanceIndexHint(draft: Draft): void {
    if (draft.instanceIndex !== undefined) this.tokens.fail("Can only specify 'instance_index' once.");
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN')
      this.tokens.fail("Expected a '(' after 'instance_index'.");
    const token = this.tokens.next();
    if (token.type === 'TK_OP_SUB') this.tokens.fail("The instance index can't be negative.");
    if (!isIntegerConstant(token)) this.tokens.fail('Expected an integer constant.');
    const index = Number(token.text);
    draft.instanceIndex = index;
    if (index >= INSTANCE_INDICES)
      this.tokens.fail(`Allowed instance uniform indices must be within [0..${INSTANCE_INDICES - 1}] range.`);
    if (this.tokens.next().type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ')'.");
  }

  /** The index `instance_index` gives, or the next free one (:10113). */
  private instanceIndexOf(draft: Draft): number {
    if (draft.instanceIndex !== undefined) return draft.instanceIndex;
    const index = this.nextInstanceIndex++;
    if (this.nextInstanceIndex > INSTANCE_INDICES)
      this.tokens.fail(`Too many 'instance' uniforms in shader, maximum supported is ${INSTANCE_INDICES}.`);
    return index;
  }

  /** `= constant`, which Godot converts to the type with `convert_constant` (:10128). */
  private defaultValue(type: ValueType, arraySize: number): readonly Scalar[] {
    if (arraySize > 0) this.tokens.fail('Setting default values to uniform arrays is not supported.');
    const value = this.expressions.expression();
    if (value.kind !== 'constant') this.tokens.fail("Expected constant expression after '='.");
    if (value.type === type) return value.values;
    const converted = convertedScalar(value, type);
    if (converted === undefined) this.tokens.fail(`Can't convert constant to '${type}'.`);
    return [converted];
  }
}

interface UniformHeader {
  readonly name: string;
  readonly type: ValueType;
  readonly arraySize: number;
  readonly scope: UniformScope;
  readonly instanceIndex: number | undefined;
  readonly defaultValue: readonly Scalar[] | undefined;
}

function uniformNode(
  draft: Draft,
  header: UniformHeader,
  group: string,
  subgroup: string,
  position: SourcePosition
): UniformNode {
  const { name, type, arraySize, scope, instanceIndex, defaultValue } = header;
  return {
    kind: 'uniform',
    name,
    type,
    ...(arraySize > 0 ? { arraySize } : {}),
    scope,
    hint: draft.hint,
    usesColor: draft.usesColor,
    ...(draft.filter !== undefined ? { filter: draft.filter } : {}),
    ...(draft.repeat !== undefined ? { repeat: draft.repeat } : {}),
    range: draft.range,
    enumNames: draft.enumNames,
    ...(instanceIndex !== undefined ? { instanceIndex } : {}),
    group,
    subgroup,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    rows: draft.rows,
    position,
  };
}

/** A hint is set once: Godot names a repeat as duplicated and another hint as a redefinition (:10067). */
function setHint(draft: Draft, hint: UniformHint, tokens: TokenCursor): void {
  if (draft.hint === hint) tokens.fail(`Duplicated hint: '${hint}'.`);
  if (draft.hint !== 'none')
    tokens.fail(`Redefinition of hint: '${hint}'. The hint has already been set to '${draft.hint}'.`);
  draft.hint = hint;
}

/** A filter or repeat mode is set once, with the messages of `setHint` (:10085, :10098). */
function setOnce(current: string | undefined, word: string, mode: string, tokens: TokenCursor): string {
  if (current === word) tokens.fail(`Duplicated ${mode} mode: '${word}'.`);
  if (current !== undefined)
    tokens.fail(
      `Redefinition of ${mode} mode: '${word}'. The ${mode} mode has already been set to '${current}'.`
    );
  return word;
}
