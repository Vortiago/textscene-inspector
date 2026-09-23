/**
 * Image resource slice, foreign-format kind (ADR-0031): a claim that imports no renderer.
 * The parser is the browser's image decoder, reached through `THREE.TextureLoader` in
 * `textureProcessing.ts`, and the `texture` bus slot caches a plain `THREE.Texture`.
 * Authored textures such as GradientTexture2D are Godot-text slices under `resources/textures/`.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'image',
  kind: 'foreign-format',
  typeNames: ['Texture2D', 'CompressedTexture2D', 'ImageTexture'],
  extensions: ['.png', '.jpg', '.jpeg', '.webp', '.svg'],
  binaryBytes: true,
  busType: 'texture',
  failureLabel: 'Material using texture',
});
