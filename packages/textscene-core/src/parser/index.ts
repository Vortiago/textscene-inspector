/**
 * Parser subpath entry (`@textscene/core/parser`): TSCN parsing without the React/R3F
 * surface of the root barrel, so non-UI consumers keep their bundles lean.
 */

export { TscnParser } from './TscnParser.js';
export { parseHeading } from './utils.js';
export type { ParsedHeading } from './utils.js';
export type * from './types.js';
