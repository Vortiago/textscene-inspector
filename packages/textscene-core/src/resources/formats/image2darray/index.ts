/**
 * Image2DArray resource slice, foreign-format kind (ADR-0031): the OpenEXR atlas a lightmap bake
 * saves, which Godot's layered importer cuts into the layers of a texture array, as its **Import
 * sidecar** says. The `texture2darray` bus slot caches a `THREE.DataArrayTexture`.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'image2darray',
  kind: 'foreign-format',
  typeNames: ['CompressedTexture2DArray'],
  extensions: ['.exr'],
  binaryBytes: true,
  busType: 'texture2darray',
});
