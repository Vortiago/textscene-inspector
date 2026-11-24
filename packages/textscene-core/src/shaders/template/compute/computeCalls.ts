import type { SourcePosition } from '../../language/shadingLanguageError.js';
import type { CallNode, Expression, Statement } from '../../language/shaderTree.js';
import { isCall } from '../../language/treeWalk.js';
import { builtInOverloads, constructorRow, resolvedOverload } from '../glslRows.js';
import { builtInCall } from '../parseGlslExpression.js';

/** A call of the GLSL built-in `name` on `operands`, typed by the overload they resolve to. */
export function glslCall(name: string, operands: readonly Expression[], position: SourcePosition): CallNode {
  const types = operands.map((operand) => operand.type);
  const row = resolvedOverload(builtInOverloads(name), types);
  if (!row) throw new Error(`expected a GLSL overload ${name}(${types.join(', ')}), found none`);
  return builtInCall(name, row, operands, position);
}

/** A constant of one lane. */
export const scalar = (type: string, value: number, position: SourcePosition): Expression => ({
  kind: 'constant',
  type,
  values: [value],
  position,
});

/** The calls that order a group's memory, which a pass that runs one invocation has no need of. */
export const BARRIER_CALLS: ReadonlySet<string> = new Set([
  'barrier',
  'memoryBarrier',
  'memoryBarrierShared',
  'memoryBarrierImage',
  'memoryBarrierBuffer',
  'groupMemoryBarrier',
]);

/** A construction of `type` from `operands`, typed by the constructor row they take. */
export function constructed(
  type: string,
  operands: readonly Expression[],
  position: SourcePosition
): Expression {
  const row = constructorRow(
    type,
    operands.map((operand) => operand.type)
  );
  return { kind: 'operator', type, op: 'OP_CONSTRUCT', row, operands, position };
}

export const isStore = (statement: Statement): statement is CallNode =>
  statement.kind === 'operator' && isCall(statement) && statement.function === 'imageStore';

/** The image `store` writes. */
export function imageOf(store: CallNode): string {
  const image = store.operands[0]!;
  if (image.kind !== 'variable')
    throw new Error(`expected an image variable to store into, got ${image.kind}`);
  return image.name;
}
