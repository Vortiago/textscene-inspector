/**
 * LabelSettings resource slice — entry point (ADR-0031).
 *
 * Claims Godot's `LabelSettings` (the font/colour/outline/spacing bundle a
 * Label's `label_settings` overrides its theme with), decoded from either
 * arrival path by `decode.ts`. Resolves to no THREE object at all, so the
 * slice has no `build.ts`.
 *
 * THREE-free and React-free, so claim consumers can read the registration
 * without pulling a renderer into their import closure.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'labelsettings',
  kind: 'godot-text',
  typeNames: ['LabelSettings'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { decodeLabelSettings, labelSettingsFromResource, resolveLabelSettings } from './decode';
export type { LabelSettingsResource } from './types';
