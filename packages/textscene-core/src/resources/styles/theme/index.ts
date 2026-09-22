/**
 * Theme resource slice — Godot-text kind (ADR-0031).
 *
 * `decode.ts` turns a Theme **ParsedResource** section into its font-relevant
 * data, from either arrival (an external `.tres` or a scene's own inline
 * `[sub_resource]`). There is no `build.ts`: a decoded Theme is plain data
 * that `lookup.ts` walks — the THREE/DOM-side work is per-CONTROL, done by the
 * painters that read the walk's answer.
 *
 * No `extensions` claim: a Theme arrives as `.tres`, the shared Godot-text
 * container every text slice would otherwise re-claim. Routing is by type name.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'theme',
  kind: 'godot-text',
  typeNames: ['Theme'],
  busType: 'theme',
  failureLabel: 'Node using theme',
});

export type { ScannedTheme, ThemeAddresses, ThemeResource } from './types';
