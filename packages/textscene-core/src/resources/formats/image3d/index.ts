/**
 * Image3D resource slice, foreign-format kind (ADR-0031): an image Godot's layered importer cuts
 * into the slices of a 3D texture, as its **Import sidecar** says. The image slice claims the
 * image extensions, so this slice claims only the type name, and the `texture3d` bus slot caches
 * a `THREE.Data3DTexture`.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'image3d',
  kind: 'foreign-format',
  typeNames: ['CompressedTexture3D'],
  busType: 'texture3d',
});
