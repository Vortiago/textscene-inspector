/**
 * StandardMaterial3D resource slice — Godot's default 3D surface (ADR-0031).
 *
 * Claims `ShaderMaterial` too: we do not compile GLSL (ADR-0004), so a
 * ShaderMaterial resolves to this slice's translucent standard-material
 * fallback rather than to a permanent missing-resources row.
 *
 * No `extensions` claim. `.tres` is Godot's one text-resource container and
 * several slices read it (TileSet, MeshLibrary, SpriteFrames, ArrayMesh), so
 * routing a `.tres` by extension would hand every one of them to this slice.
 * Its files are recognised by their `[gd_resource type=…]` instead.
 *
 * Deliberately renderer-free: this module and everything it re-exports
 * value-import neither `three` nor React, so a linter entry point can read the
 * claim table and the decoded shape without pulling a renderer into its bundle.
 * `build.ts` / `scalars.ts` / `loadMaterial.ts` are the three-facing halves and
 * are NOT reachable from here.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'standardmaterial3d',
  kind: 'godot-text',
  typeNames: ['StandardMaterial3D', 'ShaderMaterial'],
  busType: 'material',
  failureLabel: 'Node using material',
});

export { decodeStandardMaterial3D } from './decode';
export {
  BlendMode,
  CullMode,
  TEXTURE_SLOTS,
  Transparency,
  type Color,
  type MaterialBlendState,
  type MaterialVec2,
  type StandardMaterial3DData,
  type StandardMaterial3DScalars,
  type TextureSlot,
  type TextureSlotReferences,
} from './types';
