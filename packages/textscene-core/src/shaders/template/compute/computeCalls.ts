import type { SourcePosition } from '../../language/shadingLanguageError.js';
import type { CallNode, Expression } from '../../language/shaderTree.js';
import { builtInOverloads, resolvedOverload } from '../glslRows.js';

/** A call of the GLSL built-in `name` on `operands`, typed by the overload they resolve to. */
export function glslCall(name: string, operands: readonly Expression[], position: SourcePosition): CallNode {
  const types = operands.map((operand) => operand.type);
  const row = resolvedOverload(builtInOverloads(name), types);
  if (!row) throw new Error(`expected a GLSL overload ${name}(${types.join(', ')}), found none`);
  return {
    kind: 'operator',
    op: 'OP_CALL',
    row,
    function: name,
    rname: name,
    qualifiers: operands.map(() => 'in'),
    type: row.returns!,
    operands,
    position,
  };
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
