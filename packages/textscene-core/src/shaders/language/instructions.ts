/**
 * The instruction table as the parser asks it: a row by id, and the error for a row the transpiler
 * does not transpile yet, which names the issue that owns the row.
 */

import { INSTRUCTION_TABLE, type InstructionRow } from './instructionTable.generated.js';
import { ShadingLanguageError, type SourcePosition } from './shadingLanguageError.js';

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

/** The first built-in variable row of each name, in the table's order. */
const BUILT_INS_BY_NAME: ReadonlyMap<string, InstructionRow> = new Map(
  INSTRUCTION_TABLE.filter((row) => row.family.startsWith('built-in'))
    .reverse()
    .map((row) => [row.id.slice(row.id.lastIndexOf('.') + 1), row])
);

/** The first built-in variable named `name` in any stage, `canvas_item.fragment.TIME` for `TIME`. */
export function builtInInstruction(name: string): InstructionRow | undefined {
  return BUILT_INS_BY_NAME.get(name);
}

/** The rows with arguments of each name, `vec2(float,float)` under `vec2`. Written once, here. */
const OVERLOADS = new Map<string, InstructionRow[]>();
for (const row of INSTRUCTION_TABLE) {
  if (row.args === undefined || !/^\w+\(/.test(row.id)) continue;
  const name = row.id.slice(0, row.id.indexOf('('));
  const rows = OVERLOADS.get(name);
  if (rows) rows.push(row);
  else OVERLOADS.set(name, [row]);
}

/** The rows of `name(...)` with arguments, in the table's order. */
export function overloadInstructions(name: string): readonly InstructionRow[] {
  return OVERLOADS.get(name) ?? [];
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
export function notTranspiled(
  row: InstructionRow,
  position: SourcePosition,
  name = row.id
): ShadingLanguageError {
  return new ShadingLanguageError(`'${name}' is not transpiled yet (${row.owner})`, position, row.owner);
}
