/**
 * The index glslang folds past a vector or a matrix. Godot checks only an index that is one
 * constant node (`shader_language.cpp:7213`), so `a[1 + 5]` passes Godot's front end. glslang folds
 * `1 + 5` to a constant and refuses the index (`checkIndex` of its parse context).
 */

import type { GlslangFolding } from './glslangFolding.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type { Expression, Statement } from './shaderTree.js';
import { shapeOf } from './types.js';

/** Throws for the first index in `statement` that glslang folds past its owner's last element. */
export function refuseFoldedIndexOutOfRange(statement: Statement, folding: GlslangFolding): void {
  const expressions = statement.kind === 'control flow' ? statement.expressions : [statement];
  for (const expression of expressions) refuseInExpression(expression, folding);
}

function refuseInExpression(expression: Expression, folding: GlslangFolding): void {
  if (expression.kind === 'member') return refuseInExpression(expression.owner, folding);
  if (expression.kind !== 'operator') return;
  for (const operand of expression.operands) refuseInExpression(operand, folding);
  if (expression.op !== 'OP_INDEX') return;
  const [owner, index] = expression.operands as [Expression, Expression];
  const lane = folding.lanesOf(index)?.[0];
  if (lane === undefined) return;
  // glslang holds the folded index as a signed int, so `0u - 1u` is -1.
  const folded = (lane as number) | 0;
  const shape = shapeOf(owner.type)!;
  const size = shape.columns ?? shape.lanes;
  if (folded >= 0 && folded < size) return;
  throw new ShadingLanguageError(
    `glslang folds the index to ${folded}, outside [0..${size - 1}] of '${owner.type}', so the GPU compiler refuses Godot's GLSL.`,
    index.position
  );
}
