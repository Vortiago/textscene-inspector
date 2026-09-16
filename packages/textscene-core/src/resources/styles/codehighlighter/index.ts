/**
 * CodeHighlighter resource slice — Godot-text kind (ADR-0031).
 *
 * `decode.ts` turns a CodeHighlighter **ParsedResource** section into typed
 * colour data; `highlight.ts` is the line scanner that data drives. Both are
 * plain data/logic that a painter (TextEdit's `Component.tsx`) reads — no
 * `build.ts`, same split `styles/theme` uses.
 *
 * No `extensions` claim: a CodeHighlighter arrives as `.tres`, the shared
 * Godot-text container every text slice would otherwise re-claim. Routing is
 * by type name, through the shared `resource` bus every non-specialised
 * Godot-text type shares (a plain `ParsedResource`, per-type decode).
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'codehighlighter',
  kind: 'godot-text',
  typeNames: ['CodeHighlighter'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { decodeCodeHighlighter } from './decode';
export { resolveLineColors } from './highlight';
export type { CodeHighlighterColorRegion, CodeHighlighterData } from './types';
export type { CodeHighlighterColorSpan } from './highlight';
