/**
 * Prettier's formatting for the repository. `pnpm format` writes it, and `pnpm format:check` is the
 * CI gate. Each option is the one that changed the fewest lines of the code as it was written.
 */

/** @type {import('prettier').Config} */
export default {
  singleQuote: true,
  // The width the hand-formatted code wrapped at most often: 110 changed fewer lines than 100 or 120.
  printWidth: 110,
  // No trailing comma after a function's last parameter or argument, as the code was written.
  trailingComma: 'es5',
  // Git converts line endings on a Windows checkout with `core.autocrlf`, so a fixed `lf` would
  // fail every file there. The repository itself stores LF.
  endOfLine: 'auto',
};
