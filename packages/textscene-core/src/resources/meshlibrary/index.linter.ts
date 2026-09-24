/**
 * `MeshLibrary` slice linter entry, so the barrel imports an entry point rather
 * than an implementation module. It imports `.ts` only, never the render side,
 * so the linter bundle stays React- and THREE-free.
 */

import './linterValidators.js';
