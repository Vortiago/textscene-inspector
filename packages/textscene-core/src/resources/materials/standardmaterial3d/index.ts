/**
 * StandardMaterial3D resource slice, Godot's default 3D surface (ADR-0031). It claims
 * `ShaderMaterial` too, which resolves to that surface (ADR-0041). No extension claim:
 * several slices read `.tres`, so its files are recognised by `[gd_resource type=…]`.
 * A `.tres` material loads on the resource bus as a parsed file, which `useMaterial`
 * reads like a scene's own material. Renderer-free for the linter: `build.ts` and
 * `scalars.ts` sit outside.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'standardmaterial3d',
  kind: 'godot-text',
  typeNames: ['StandardMaterial3D', 'ShaderMaterial'],
  busType: 'resource',
});
