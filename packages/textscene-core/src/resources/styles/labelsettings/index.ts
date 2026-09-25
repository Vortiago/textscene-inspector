/**
 * LabelSettings resource slice entry point (ADR-0031). It resolves to no THREE
 * object, so it has no `build.ts`. THREE-free and React-free, so a claim
 * consumer pulls in no renderer.
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
