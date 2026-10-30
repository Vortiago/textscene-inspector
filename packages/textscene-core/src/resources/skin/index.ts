/**
 * Skin resource slice, Godot-text kind (ADR-0031). It decodes to plain binds, so there is no
 * `build.ts`: a Skeleton3D turns them into the matrices that skin a mesh. A Skin arrives as a
 * scene sub-resource or as the shared `.tres` container, so the slice claims the type name only.
 */

import { registerResourceSlice } from '../sliceRegistration';

registerResourceSlice({
  slice: 'skin',
  kind: 'godot-text',
  typeNames: ['Skin'],
  busType: 'resource',
});

export { decodeSkin } from './decode';
