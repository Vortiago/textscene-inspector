/**
 * Linter entry point for the base Control slice: registers the Control property
 * validators inherited by the whole 2D UI family via the base-walk (#143).
 * Imports only `.ts` — never `Component.tsx` — to keep the linter bundle
 * React/THREE-free.
 */
import './linterParser.js';
