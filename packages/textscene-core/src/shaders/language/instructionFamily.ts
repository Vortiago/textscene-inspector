/** The family of a row of the instruction table, as every reader of the table tells it. It imports nothing, so a plain Node script reads it. */

/**
 * A built-in function overload, of Godot's plain set or its high_end one.
 *
 * @canonical Tell a built-in function row of the instruction table
 */
export const isFunctionRow = (row: { readonly family: string }) =>
  row.family === 'function' || row.family === 'function (high_end)';
