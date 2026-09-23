/**
 * `TileSet` slice linter entry point, which the linter barrel imports. It imports
 * `.ts` only, so the linter bundle stays React- and THREE-free. The validators
 * self-register on import.
 */

import './linterValidators.js';
