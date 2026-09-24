/**
 * StandardMaterial3D resource slice, Godot's default 3D surface (ADR-0031). It claims
 * `ShaderMaterial` too, which resolves to that surface (ADR-0041). No extension claim:
 * several slices read `.tres`, so its files are recognised by `[gd_resource type=…]`.
 * Renderer-free for the linter: `build.ts`, `scalars.ts` and `loadMaterial.ts` sit outside.
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
