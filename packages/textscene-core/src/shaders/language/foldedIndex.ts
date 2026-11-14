/**
 * The index glslang folds past a vector, a matrix or an array. Godot checks only an index that is
 * one constant node (`shader_language.cpp:7213`), so `a[1 + 5]` passes Godot's front end. glslang
 * folds `1 + 5` to a constant and refuses the index (`checkIndex` of its parse context).
 */

import type { GlslangFolding } from './glslangFolding.js';
import { arraySizeOf, typeName } from './parseExpression.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type { BlockNode, Expression } from './shaderTree.js';
import { everyExpressionIn } from './treeWalk.js';
import { shapeOf } from './types.js';

/** Throws for the first index in `block` that glslang folds past its owner's last element. */
export function refuseFoldedIndexOutOfRange(block: BlockNode, folding: GlslangFolding): void {
  for (const part of everyExpressionIn(block)) refuseIndex(part, folding);
}

function refuseIndex(expression: Expression, folding: GlslangFolding): void {
  if (expression.kind === 'array element') return refuseFolded(expression.array, expression.index, folding);
  if (expression.kind === 'operator' && expression.op === 'OP_INDEX')
    refuseFolded(expression.operands[0]!, expression.operands[1]!, folding);
}

function refuseFolded(owner: Expression, index: Expression, folding: GlslangFolding): void {
  const lane = folding.lanesOf(index)?.[0];
  if (lane === undefined) return;
  // glslang holds the folded index as a signed int, so `0u - 1u` is -1.
  const folded = (lane as number) | 0;
  const size = elementCount(owner);
  if (folded >= 0 && folded < size) return;
  throw new ShadingLanguageError(
    `glslang folds the index to ${folded}, outside [0..${size - 1}] of '${ownerName(owner)}', so the GPU compiler refuses Godot's GLSL.`,
    index.position
  );
}

function elementCount(owner: Expression): number {
  const arraySize = arraySizeOf(owner);
  if (arraySize > 0) return arraySize;
  const shape = shapeOf(owner.type)!;
  return shape.columns ?? shape.lanes;
}

const ownerName = (owner: Expression) => typeName(owner.type, arraySizeOf(owner));
