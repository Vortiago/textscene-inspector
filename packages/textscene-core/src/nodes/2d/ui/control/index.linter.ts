/**
 * Linter entry point for the base Control slice: the property validators and the
 * semantic rules, which reach the whole 2D UI family through `NODE_BASE_TYPES`.
 * Imports only `.ts`, never `Component.tsx`, to keep the linter bundle React-free and THREE-free.
 */
import './linterParser.js';
import './linter.js';
