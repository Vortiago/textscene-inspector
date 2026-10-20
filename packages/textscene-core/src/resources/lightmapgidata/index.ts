/**
 * LightmapGIData resource slice, Godot-text kind (ADR-0031). A bake arrives as a binary `.lmbake`,
 * which the binaryresource slice reads into the same ParsedResource a `.tres` gives, so this slice
 * claims the type name only. No `build.ts`: the render layer builds the atlas from the decoded
 * texture paths.
 */

import { registerResourceSlice } from '../sliceRegistration';

registerResourceSlice({
  slice: 'lightmapgidata',
  kind: 'godot-text',
  typeNames: ['LightmapGIData'],
  busType: 'resource',
});
