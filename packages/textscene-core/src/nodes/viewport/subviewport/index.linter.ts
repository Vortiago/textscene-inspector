/**
 * SubViewport registration — strict validators.
 * Imports only `.ts` (never `./Component`), preserving the React-free linter boundary.
 *
 * No semantic rule: the only condition one checked, a degenerate size, is a
 * clamp the engine applies (viewport.cpp:1120), so `linterParser.ts` reports it
 * as an error and a warning restating it would be a second voice on one fact.
 */

import './linterParser.js';
