import type { CallNode, Expression } from '../language/shaderTree.js';
import { isCall, withSubExpressions } from '../language/treeWalk.js';

/** The built-in whose texture calls Godot's compiler writes as octmap reads (`shader_compiler.cpp:1320`). */
const RADIANCE = 'RADIANCE';

/** The texture functions that take no coordinate, so their arguments stay as written (`:1189`). */
const NO_COORDINATE = new Set(['textureSize', 'textureQueryLevels']);

/** Parses `text` in the template, with each placeholder name of `operands` read as that expression. */
export type ParseWithOperands = (text: string, operands: ReadonlyMap<string, Expression>) => Expression;

/** What Godot's compiler reads beside the call: the GLSL text of the built-in and its sampler. */
export interface RadianceRead {
  readonly texture: string;
  readonly sampler: string;
}

/** Whether `expression` is a texture call on the sky's `samplerCube` `RADIANCE`, not the spatial `vec4`. */
export function isRadianceCall(expression: Expression): expression is CallNode {
  if (!isCall(expression) || expression.row.id === 'OP_CALL') return false;
  const sampler = expression.operands[0];
  return (
    sampler?.kind === 'variable' &&
    sampler.builtIn !== undefined &&
    sampler.name === RADIANCE &&
    sampler.type === 'samplerCube'
  );
}

/** The call as Godot's compiler writes it, its bias read as the level (`shader_compiler.cpp:1319-1371`). */
export function radianceCall(call: CallNode, read: RadianceRead, parse: ParseWithOperands): Expression {
  const [, coordinate, ...rest] = call.operands;
  const operands = new Map<string, Expression>();
  const placeholder = (expression: Expression) => {
    const name = `radiance_operand_${operands.size}`;
    operands.set(name, expression);
    return name;
  };
  const isSimple = call.function === 'texture';
  const name = isSimple ? 'textureLod' : call.function;
  const args = [`sampler2D(${read.texture}, ${read.sampler})`];
  if (coordinate) {
    const placed = placeholder(coordinate);
    args.push(
      NO_COORDINATE.has(call.function) ? placed : `vec3_to_oct_with_border(${placed}, params.border_size)`
    );
  }
  args.push(...rest.map(placeholder));
  if (isSimple && rest.length === 0) args.push('0.0');
  return withOperandsPlaced(parse(`${name}(${args.join(', ')})`, operands), operands);
}

/** `expression` with each variable named in `operands` replaced by its expression. */
function withOperandsPlaced(expression: Expression, operands: ReadonlyMap<string, Expression>): Expression {
  const placed = (part: Expression): Expression => {
    if (part.kind === 'variable' && operands.has(part.name)) return operands.get(part.name)!;
    return withSubExpressions(part, placed);
  };
  return placed(expression);
}
