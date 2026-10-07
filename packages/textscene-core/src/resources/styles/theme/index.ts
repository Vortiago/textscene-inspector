/**
 * Theme resource slice, Godot-text kind (ADR-0031). No `build.ts`: `lookup.ts`
 * walks the decoded data, and each Control's painter does the drawing. No
 * `extensions` claim: `.tres` is shared, so routing is by type name.
 */

import { registerResourceSlice } from '../../sliceRegistration';
import { THEME_TYPES } from './decode';

registerResourceSlice({
  slice: 'theme',
  kind: 'godot-text',
  typeNames: [...THEME_TYPES],
  busType: 'theme',
});

export type { ScannedTheme, ThemeAddresses, ThemeResource } from './types';
