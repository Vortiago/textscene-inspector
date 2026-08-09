/**
 * Linter entry point for VSlider: the Range property-order semantic rule.
 * VSlider's format validators are inherited from Control via the
 * `NODE_BASE_TYPES` base-walk (no `linterParser.ts` of its own). Imports
 * only `.ts` — never `Component.tsx` — to keep the linter bundle
 * React/THREE-free.
 */
import './linter.js';
