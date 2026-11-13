/**
 * The instruction table as the parser asks it: a row by id, and the error for a row the transpiler
 * does not transpile yet, which names the issue that owns the row.
 */

import { INSTRUCTION_TABLE, type InstructionRow } from './instructionTable.generated.js';
import { ShadingLanguageError } from './shadingLanguageError.js';

const ROWS_BY_ID: ReadonlyMap<string, InstructionRow> = new Map(
  INSTRUCTION_TABLE.map((row) => [row.id, row])
);

/** The row `id`, or nothing when Godot has no such instruction. */
export function instruction(id: string): InstructionRow | undefined {
  return ROWS_BY_ID.get(id);
}

/** The overload or signature row `name(type,type)` for `types`, or nothing when Godot has none. */
export function signatureInstruction(name: string, types: readonly string[]): InstructionRow | undefined {
  return ROWS_BY_ID.get(`${name}(${types.join(',')})`);
}

/** The first row whose id starts with `prefix`, for an instruction the parser refuses before it types it. */
export function firstInstruction(prefix: string): InstructionRow | undefined {
  return INSTRUCTION_TABLE.find((row) => row.id.startsWith(prefix));
}

/** Every row of `family`, in the table's order. */
export function familyInstructions(family: string): InstructionRow[] {
  return INSTRUCTION_TABLE.filter((row) => row.family === family);
}

/** The first built-in variable named `name` in any stage, `canvas_item.fragment.TIME` for `TIME`. */
export function builtInInstruction(name: string): InstructionRow | undefined {
  return INSTRUCTION_TABLE.find((row) => row.family.startsWith('built-in') && row.id.endsWith(`.${name}`));
}

const ROWS_BY_TOKEN: ReadonlyMap<string, InstructionRow> = new Map(
  INSTRUCTION_TABLE.filter((row) => row.token !== undefined).map((row) => [row.token!, row])
);

/** The row with the keyword token `token`. */
export function keywordInstruction(token: string): InstructionRow | undefined {
  return ROWS_BY_TOKEN.get(token);
}

/** The text of each keyword and its token, from `keyword_list` (`shader_language.cpp:283`). */
export const KEYWORD_TOKENS: ReadonlyMap<string, string> = new Map(
  [...ROWS_BY_TOKEN.values()].map((row) => [row.id, row.token!])
);

/** The refusal of `row`, named `name` when the text names less than one row, as `sin` for `sin(float)`. */
export function notTranspiled(row: InstructionRow, line: number, name = row.id): ShadingLanguageError {
  return new ShadingLanguageError(`'${name}' is not transpiled yet (${row.owner})`, line);
}
