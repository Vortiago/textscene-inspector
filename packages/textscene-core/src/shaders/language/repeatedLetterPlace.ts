/**
 * The `out` or `inout` argument glslang refuses: a swizzle that repeats a letter, at any depth of
 * the place. Godot checks a repeated letter only for an assignment, so `f(a.xx.x)` passes Godot's
 * front end, and glslang refuses the place (`lValueErrorCheck` of its parse context).
 */

import { writtenTargets } from './assignment.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type { BlockNode, Expression } from './shaderTree.js';
import { everyExpressionIn, isCall } from './treeWalk.js';

/** Throws for the first `out` or `inout` argument in `block` whose place repeats a swizzle letter. */
export function refuseRepeatedLetterPlaces(block: BlockNode): void {
  for (const part of everyExpressionIn(block)) {
    if (!isCall(part)) continue;
    const place = writtenTargets(part).find(repeatsLetter);
    if (place)
      throw new ShadingLanguageError(
        "glslang refuses a swizzle that repeats a letter as a place to write, so the GPU compiler refuses Godot's GLSL.",
        place.position
      );
  }
}

function repeatsLetter(place: Expression): boolean {
  switch (place.kind) {
    case 'member':
      return place.hasDuplicates || repeatsLetter(place.owner);
    case 'field':
      return repeatsLetter(place.owner);
    case 'array element':
      return repeatsLetter(place.array);
    default:
      return false;
  }
}
