/**
 * Sky resource slice entry point (ADR-0031): the routing claims and the decode
 * surface. THREE-free and React-free. One slice for four type names, because
 * `Sky` is an indirection and the three materials are what its `sky_material`
 * resolves to.
 */

import { registerResourceSlice } from '../sliceRegistration';

// The `resource` slot, not the material processor: its `BUILDABLE_MATERIAL_TYPES`
// gate throws on a sky material, which `useSubOrExtResource` then never sees.
registerResourceSlice({
  slice: 'sky',
  kind: 'godot-text',
  typeNames: ['Sky', 'ProceduralSkyMaterial', 'PanoramaSkyMaterial', 'PhysicalSkyMaterial'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { decodeSkyMaterial, skyMaterialRef } from './decode';
export type {
  PanoramaSkyProperties,
  PhysicalSkyProperties,
  ProceduralSkyProperties,
  SkyProperties,
} from './types';
