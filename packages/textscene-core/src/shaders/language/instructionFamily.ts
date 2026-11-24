/**
 * A built-in function overload, of Godot's plain set or its high_end one.
 *
 * @canonical Tell a built-in function row of the instruction table
 */
export const isFunctionRow = (row: { readonly family: string }) =>
  row.family === 'function' || row.family === 'function (high_end)';
