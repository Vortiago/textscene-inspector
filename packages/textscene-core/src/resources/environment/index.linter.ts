/**
 * `Environment` slice LINTER entry point — the aggregation import the linter
 * barrel wires, mirroring a node slice's `index.linter.ts`.
 *
 * Imports `.ts` only and never the render side, so the linter bundle stays
 * React- and THREE-free. The validators self-register on import; this file
 * exists so the barrel names an entry point rather than an implementation
 * module.
 */

import './linterValidators.js';
