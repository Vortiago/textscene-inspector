import { writtenTargets } from './assignment.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type { BlockNode, Expression } from './shaderTree.js';
import { everyExpressionIn, isCall } from './treeWalk.js';

/** Throws for the first `out` or `inout` argument in `block` that is no l-value. */
export function refuseOutArgumentsThatAreNoPlace(block: BlockNode): void {
  for (const part of everyExpressionIn(block)) {
    if (!isCall(part)) continue;
    const argument = writtenTargets(part).find((place) => refusal(place) !== undefined);
    if (argument)
      throw new ShadingLanguageError(
        `glslang refuses ${refusal(argument)} as an out or inout argument, so the GPU compiler refuses Godot's GLSL.`,
        argument.position
      );
  }
}

/** Why glslang refuses `place` as an l-value, or nothing for an l-value. */
function refusal(place: Expression): string | undefined {
  switch (place.kind) {
    case 'variable':
      return undefined;
    case 'member':
      return place.hasDuplicates ? 'a swizzle that repeats a letter' : refusal(place.owner);
    case 'field':
      return refusal(place.owner);
    case 'array element':
      return refusal(place.array);
    default:
      return 'a value that is no variable';
  }
}
