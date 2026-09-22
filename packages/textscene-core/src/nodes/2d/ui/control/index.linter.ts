/**
 * Linter entry point for the base Control slice: registers the Control property
 * validators inherited by the whole 2D UI family via the base-walk, plus the
 * semantic property-order rule (`linter.ts`) that reaches the same family through
 * `NODE_BASE_TYPES`. Imports only `.ts` — never `Component.tsx` — to keep the
 * linter bundle React/THREE-free.
 */
import './linterParser.js';
import './linter.js';
