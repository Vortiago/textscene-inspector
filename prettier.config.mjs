/** Prettier's formatting for the repository. `pnpm format` writes it, and `pnpm format:check` checks it. */

/** @type {import('prettier').Config} */
export default {
  singleQuote: true,
  printWidth: 110,
  trailingComma: 'es5',
  // Git converts line endings on a Windows checkout with `core.autocrlf`, so a fixed `lf` would
  // fail every file there. The repository itself stores LF.
  endOfLine: 'auto',
};
