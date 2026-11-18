import { registerResourceSlice } from '../../sliceRegistration';

// The image slice claims the image extensions, so this slice claims only the type name.
registerResourceSlice({
  slice: 'imagecubemap',
  kind: 'foreign-format',
  typeNames: ['CompressedCubemap'],
  busType: 'cubemap',
});
