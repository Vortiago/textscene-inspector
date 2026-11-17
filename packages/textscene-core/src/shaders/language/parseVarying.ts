import { keywordInstruction } from './instructions.js';
import type { ExpressionParser } from './parseExpression.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { VaryingNode } from './shaderTree.js';
import type { TokenCursor } from './tokenCursor.js';
import type { Token } from './tokenizer.js';
import { shapeOf } from './types.js';

/** The shader types with no varyings: each has one stage function (`shader_language.cpp:9538`). */
const ONE_STAGE_TYPES: ReadonlySet<string> = new Set(['particles', 'sky', 'fog']);

/** What the varying parser asks of the shader parser around it. */
export interface VaryingContext {
  readonly shaderType: () => string | undefined;
  readonly isStruct: (name: string) => boolean;
  /** Whether a global, a function or a built-in of the shader type has the name already. */
  readonly isTaken: (name: string) => boolean;
}

/** `varying [flat|smooth] [precision] type name[size];` (`shader_language.cpp:9531`). */
export function parseVarying(
  tokens: TokenCursor,
  expressions: ExpressionParser,
  context: VaryingContext
): VaryingNode {
  const shaderType = context.shaderType();
  if (shaderType !== undefined && ONE_STAGE_TYPES.has(shaderType))
    tokens.fail(`Varyings cannot be used in '${shaderType}' shaders.`);
  let token = tokens.next();
  const interpolation = interpolationOf(token);
  if (interpolation) token = tokens.next();
  const hasPrecision = token.type.startsWith('TK_PRECISION_');
  if (hasPrecision) token = tokens.next();
  const type = varyingType(token, hasPrecision, interpolation, tokens, context);
  token = tokens.next();
  if (token.type !== 'TK_IDENTIFIER' && token.type !== 'TK_BRACKET_OPEN')
    tokens.fail("Expected an identifier or '['.");
  let arraySize = 0;
  if (token.type === 'TK_BRACKET_OPEN') {
    arraySize = expressions.arrays.size(true)!;
    token = tokens.next();
  }
  if (token.type !== 'TK_IDENTIFIER') tokens.fail('Expected an identifier.');
  const nameToken = token;
  if (context.isTaken(nameToken.text!)) tokens.fail(`Redefinition of '${nameToken.text}'.`);
  token = tokens.next();
  if (token.type !== 'TK_SEMICOLON' && token.type !== 'TK_BRACKET_OPEN')
    tokens.fail(arraySize === 0 ? "Expected a ';' or '['." : "Expected a ';'.");
  if (token.type === 'TK_BRACKET_OPEN') {
    arraySize = expressions.arrays.size(true)!;
    // Godot reads the token after the size as the end of the statement, whatever it is.
    tokens.next();
  }
  return varyingNode(nameToken.text!, type, interpolation, arraySize, nameToken.position);
}

function interpolationOf(token: Token): VaryingNode['interpolation'] {
  if (token.type === 'TK_INTERPOLATION_FLAT') return 'flat';
  return token.type === 'TK_INTERPOLATION_SMOOTH' ? 'smooth' : undefined;
}

/** A value type up to `mat4`, and no interpolation on a boolean one. */
function varyingType(
  token: Token,
  hasPrecision: boolean,
  interpolation: VaryingNode['interpolation'],
  tokens: TokenCursor,
  context: VaryingContext
): string {
  if (token.type === 'TK_IDENTIFIER' && context.isStruct(token.text!))
    tokens.fail("The 'struct' data type is not allowed here.");
  const row = keywordInstruction(token.type);
  if (row?.family !== 'data type' || row.id === 'struct type') tokens.fail('Expected data type.');
  const shape = shapeOf(row.id);
  if (hasPrecision && shape?.scalar === 'bool')
    tokens.fail('The precision modifier cannot be used on boolean types.');
  if (row.id === 'void') tokens.fail("The 'void' data type is not allowed here.");
  if (interpolation && shape?.scalar === 'bool')
    tokens.fail(`Interpolation modifier '${interpolation}' cannot be used with boolean types.`);
  if (shape === undefined) tokens.fail('Invalid data type for varying.');
  return row.id;
}

function varyingNode(
  name: string,
  type: string,
  interpolation: VaryingNode['interpolation'],
  arraySize: number,
  position: SourcePosition
): VaryingNode {
  return {
    kind: 'varying',
    name,
    type,
    ...(interpolation ? { interpolation } : {}),
    ...(arraySize > 0 ? { arraySize } : {}),
    position,
  };
}

/** The tokens of an assignment, `is_token_operator_assign` (`shader_language.cpp:4165`). */
const ASSIGN_TOKENS: ReadonlySet<string> = new Set([
  'TK_OP_ASSIGN',
  'TK_OP_ASSIGN_ADD',
  'TK_OP_ASSIGN_SUB',
  'TK_OP_ASSIGN_MUL',
  'TK_OP_ASSIGN_DIV',
  'TK_OP_ASSIGN_MOD',
  'TK_OP_ASSIGN_SHIFT_LEFT',
  'TK_OP_ASSIGN_SHIFT_RIGHT',
  'TK_OP_ASSIGN_BIT_AND',
  'TK_OP_ASSIGN_BIT_OR',
  'TK_OP_ASSIGN_BIT_XOR',
]);

/** The stage function that assigned a varying first, Godot's `Varying::Stage`. */
type Stage = 'vertex' | 'fragment';

/** Where a shader may write and read each varying, in the order Godot reads the text. */
export class VaryingStages {
  /** Written only by `assign`, the first time each varying is assigned. */
  private readonly stages = new Map<string, Stage>();

  constructor(private readonly tokens: TokenCursor) {}

  /** A read or a write of `varying` in the function `current`, after its name (`shader_language.cpp:6598`). */
  use(varying: VaryingNode, current: string): void {
    if (this.isAssignment()) return this.assign(varying, current);
    if (this.stages.has(varying.name) || !isBoolean(varying.type)) return;
    this.tokens.fail(
      current === 'vertex'
        ? `Varying with '${varying.type}' data type may only be used in the 'fragment' function.`
        : `Varying '${varying.name}' must be assigned in the 'fragment' function first.`
    );
  }

  /** The stage `name` is assigned in so far, or nothing. */
  stageOf(name: string): Stage | undefined {
    return this.stages.get(name);
  }

  /** Godot's message for `varying` passed for a parameter of `qualifier` in `current`, or nothing (:6380). */
  argumentRefusal(varying: VaryingNode, qualifier: string, current: string): string | undefined {
    const isOut = qualifier !== 'in';
    const stage = this.stages.get(varying.name);
    const isRefused =
      stage === undefined
        ? isOut
        : stage === 'vertex'
          ? isOut && current !== 'vertex'
          : isOut
            ? current !== 'fragment'
            : current !== 'fragment' && current !== 'light';
    return isRefused
      ? `Varying '${varying.name}' cannot be passed for the '${qualifier}' parameter in that context.`
      : undefined;
  }

  /** Whether the varying is written, as Godot tells from the token after it, or after `[i]`. */
  private isAssignment(): boolean {
    const mark = this.tokens.mark();
    let next = this.tokens.next();
    if (next.type === 'TK_BRACKET_OPEN') {
      this.tokens.next();
      this.tokens.next();
      next = this.tokens.next();
    }
    this.tokens.reset(mark);
    return ASSIGN_TOKENS.has(next.type);
  }

  /** `_validate_varying_assign` (`shader_language.cpp:5405`). */
  private assign(varying: VaryingNode, current: string): void {
    if (current !== 'vertex' && current !== 'fragment')
      this.tokens.fail(`Varying may not be assigned in the '${current}' function.`);
    const stage = this.stages.get(varying.name);
    if (stage === undefined) {
      if (current === 'vertex' && isBoolean(varying.type))
        this.tokens.fail(
          `Varying with '${varying.type}' data type may only be assigned in the 'fragment' function.`
        );
      this.stages.set(varying.name, current);
    } else if (stage !== current)
      this.tokens.fail(
        `Varyings which assigned in '${stage}' function may not be reassigned in '${current}' or 'light'.`
      );
  }
}

const isBoolean = (type: string) => shapeOf(type)?.scalar === 'bool';
