/**
 * `Environment` resource slice entry point (ADR-0031): the routing claim and the data
 * types, for an inline `[sub_resource]` and a standalone `.tres` alike. It stays
 * THREE-free and React-free: only the render layer imports `build.ts` and its shaders.
 */

import { registerResourceSlice } from '../sliceRegistration';

registerResourceSlice({
  slice: 'environment',
  kind: 'godot-text',
  typeNames: ['Environment'],
  busType: 'resource',
});

export type { EnvironmentProperties, EnvironmentSettings } from './types';
