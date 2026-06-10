/**
 * Parser subpath entry (`@textscene/core/parser`) — TSCN parsing without
 * the React/R3F surface of the root barrel, so extension hosts and other
 * non-UI consumers keep their bundles lean.
 */

export { TscnParser } from './TscnParser.js';
export type * from './types.js';
