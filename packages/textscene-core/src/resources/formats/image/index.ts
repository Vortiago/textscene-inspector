/**
 * Image resource slice — foreign-format kind (ADR-0031).
 *
 * The real parser is the host's own image decoder: `textureProcessing.ts`
 * hands the fetched bytes to `THREE.TextureLoader` through a blob URL and the
 * browser decodes PNG/JPEG/WebP/SVG. There is no `decode.ts`/`build.ts` split
 * to make — the bytes never pass through a **ParsedResource**.
 *
 * The slice owns no type of its own: what it caches on the `texture` bus slot
 * is a plain `THREE.Texture`. This index therefore stays a pure claim
 * declaration, and imports no renderer.
 *
 * Godot's own `Texture2D` resources that are AUTHORED rather than imported
 * (GradientTexture2D, NoiseTexture2D, …) are separate Godot-text slices under
 * `resources/textures/`; the claims here are the imported-image types whose
 * `ext_resource` points at an image file on disk.
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
