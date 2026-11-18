import { signatureInstruction } from './instructions.js';
import type { InstructionRow } from './instructionTable.generated.js';
import { ShadingLanguageError, type SourcePosition } from './shadingLanguageError.js';
import type { BlockNode, Expression, OperatorNode, ShaderNode, Statement } from './shaderTree.js';
import { everyStatement, isCall, subExpressions, withExpressionsMapped } from './treeWalk.js';
import { shapeOf, type ValueType } from './types.js';

/** The rows whose GLSL type differs from the type Godot declares: Godot writes the call through as it is. */
const GLSL_RETURNS: Readonly<Record<string, ValueType>> = {
  // `shader_language.cpp:3177` declares an ivec2. GLSL's textureSize of a samplerCubeArray is an ivec3.
  'textureSize(samplerCubeArray,int)': 'ivec3',
};

/** The type the GLSL of row `row` returns. */
export const glslReturnOf = (row: InstructionRow): string | undefined => GLSL_RETURNS[row.id] ?? row.returns;

const lanesOf = (type: string) => shapeOf(type)?.lanes ?? 1;

/** GLSL's constructor rule: each argument before the last is used whole, and the last gives a lane. */
function isConstructible(type: string, operands: readonly Expression[]): boolean {
  if (operands.length === 1) return true;
  const lanes = operands.map((operand) => lanesOf(operand.type));
  const beforeLast = lanes.slice(0, -1).reduce((sum, count) => sum + count, 0);
  return beforeLast < lanesOf(type);
}

/** GLSL refuses `site` for a value whose type `origin` explains, so Godot's shader does not compile. */
function refused(site: string, origin: string, position: SourcePosition): never {
  throw new ShadingLanguageError(
    `Godot's shader does not compile: its GLSL of ${origin}, and GLSL has no ${site}.`,
    position
  );
}

/**
 * `shader` with GLSL's type on each value whose GLSL type differs, refused where GLSL refuses it.
 * @canonical Give a value the type GLSL gives it, where Godot declares another.
 */
export function withGlslTypes(shader: ShaderNode): ShaderNode {
  const typing = new GlslTyping();
  return {
    ...shader,
    functions: shader.functions.map((definition) => ({ ...definition, body: typing.block(definition.body) })),
  };
}

class GlslTyping {
  /** Written only by `mark`: each value this pass gave another type, and the call it comes from. */
  private readonly origins = new WeakMap<Expression, string>();

  block(body: BlockNode): BlockNode {
    const typed = withExpressionsMapped(body, (expression) => this.expression(expression));
    for (const statement of everyStatement(typed)) this.checkStatement(statement);
    return typed;
  }

  /** A declaration and a flow take the type Godot declares, and GLSL converts no vector to another size. */
  private checkStatement(statement: Statement): void {
    const values =
      statement.kind === 'declaration'
        ? statement.declarators.flatMap(({ value }) => (value ? [value] : []))
        : statement.kind === 'control flow'
          ? statement.expressions
          : [];
    for (const value of values) {
      const origin = this.origins.get(value);
      if (origin) refused('conversion to the type Godot declares there', origin, value.position);
    }
  }

  /** `expression`, its parts typed already, with GLSL's type. */
  private expression(expression: Expression): Expression {
    if (expression.kind === 'operator' && isCall(expression) && GLSL_RETURNS[expression.row.id]) {
      const glsl = GLSL_RETURNS[expression.row.id]!;
      const origin = `${expression.row.id} is an ${glsl} where Godot declares an ${expression.type}`;
      return this.mark({ ...expression, type: glsl }, origin);
    }
    const origin = subExpressions(expression)
      .map((part) => this.origins.get(part))
      .find((found) => found !== undefined);
    if (origin === undefined || expression.kind === 'member') return expression;
    if (expression.kind !== 'operator')
      return refused(`${expression.kind} of it`, origin, expression.position);
    if (expression.op === 'OP_CONSTRUCT') return this.constructed(expression, origin);
    return this.resolved(expression, origin);
  }

  private constructed(expression: OperatorNode, origin: string): Expression {
    if (!isConstructible(expression.type, expression.operands))
      refused(
        `${expression.type}(${typesOf(expression)}) that uses every argument`,
        origin,
        expression.position
      );
    return expression;
  }

  /** The operator or built-in call of the same name over GLSL's types, which GLSL resolves alike. */
  private resolved(expression: OperatorNode, origin: string): Expression {
    const { row } = expression;
    const name = row.id.slice(0, Math.max(row.id.indexOf('('), 0));
    const glslRow = name
      ? signatureInstruction(
          name,
          expression.operands.map((part) => part.type)
        )
      : undefined;
    if (!glslRow?.returns)
      return refused(`${name || row.id}(${typesOf(expression)})`, origin, expression.position);
    const typed = { ...expression, row: glslRow, type: glslRow.returns as ValueType };
    return glslRow.returns === expression.type ? typed : this.mark(typed, origin);
  }

  private mark(expression: Expression, origin: string): Expression {
    this.origins.set(expression, origin);
    return expression;
  }
}

const typesOf = (expression: OperatorNode) => expression.operands.map((part) => part.type).join(',');
