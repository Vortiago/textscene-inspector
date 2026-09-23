/**
 * `Environment` slice linter entry point, which the linter barrel imports as it does
 * a node slice's `index.linter.ts`. It imports `.ts` only, never the render side, so
 * the linter bundle stays React- and THREE-free. The validators self-register.
 */

import './linterValidators.js';
