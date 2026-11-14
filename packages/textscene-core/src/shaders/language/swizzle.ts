/**
 * Godot's swizzle rules (`shader_language.cpp:6850-7090`): the letter sets `xyzw`, `rgba` and
 * `stpq` of a vector of any scalar kind, and Godot's messages for letters that do not fit.
 */

import { instruction } from './instructions.js';
import type { Expression, MemberNode } from './shaderTree.js';
import { shapeOf, vectorType } from './types.js';

const LETTER_SETS = ['xyzw', 'rgba', 'stpq'];

/** The longest swizzle Godot reads. */
const MAX_LETTERS = 4;

/**
 * The member `.letters` of `owner`, or Godot's message for it. Godot reads every letter before it
 * decides, so a letter from a second set wins over a letter the type does not have.
 */
export function swizzled(owner: Expression, letters: string): MemberNode | string {
  const invalid = `Invalid member for '${owner.type}' expression: '.${letters}'.`;
  const shape = shapeOf(owner.type);
  if (!shape || shape.columns !== undefined || shape.lanes === 1 || letters.length > MAX_LETTERS)
    return invalid;
  const sets = LETTER_SETS.map((set) => set.slice(0, shape.lanes));
  const seen = new Set<string>();
  let set: string | undefined;
  let mixesSets = false;
  let isValid = true;
  let hasDuplicates = false;
  for (const letter of letters) {
    const letterSet = sets.find((candidate) => candidate.includes(letter));
    if (!letterSet) isValid = false;
    else if (set !== undefined && letterSet !== set) mixesSets = true;
    else {
      set = letterSet;
      if (seen.has(letter)) hasDuplicates = true;
      seen.add(letter);
    }
  }
  if (mixesSets) return `Cannot combine symbols from different sets in expression '.${letters}'.`;
  if (!isValid || set === undefined) return invalid;
  const row = instruction(`${owner.type}.${set}`)!;
  return {
    kind: 'member',
    type: vectorType(shape.scalar, letters.length),
    owner,
    name: letters,
    row,
    hasDuplicates,
    position: owner.position,
  };
}

/** The lane each letter of a swizzle reads: `zx` reads lanes 2 and 0. */
export function swizzleLanes(member: MemberNode): number[] {
  const set = member.row.id.slice(member.row.id.indexOf('.') + 1);
  return [...member.name].map((letter) => set.indexOf(letter));
}
