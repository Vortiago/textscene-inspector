/**
 * Linter entry point for HSlider: the Range property-order semantic rule.
 * HSlider's format validators are inherited from Control via the
 * `NODE_BASE_TYPES` base-walk (no `linterParser.ts` of its own). Imports
 * only `.ts` — never `Component.tsx` — to keep the linter bundle
 * React/THREE-free.
 */
import './linter.js';
