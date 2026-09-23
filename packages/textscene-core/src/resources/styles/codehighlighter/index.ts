/**
 * CodeHighlighter resource slice, Godot-text kind (ADR-0031). `decode.ts` makes
 * colour data and `highlight.ts` scans lines with it, for TextEdit's
 * `Component.tsx`. No `build.ts`. No `extensions` claim: `.tres` is shared, so
 * routing is by type name through the `resource` bus.
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
