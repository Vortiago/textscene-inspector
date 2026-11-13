/**
 * Sky resource slice entry point (ADR-0031): the routing claims and the data
 * types. THREE-free and React-free. One slice for four type names, because
 * `Sky` is an indirection and the three materials are what its `sky_material`
 * resolves to.
 */

import { registerResourceSlice } from '../sliceRegistration';

// The `resource` bus, whose parsed files the reading module's snapshot reads: a sky file on
// any other bus never reaches the `SKY` kind.
registerResourceSlice({
  slice: 'sky',
  kind: 'godot-text',
  typeNames: ['Sky', 'ProceduralSkyMaterial', 'PanoramaSkyMaterial', 'PhysicalSkyMaterial'],
  busType: 'resource',
});

export type {
  PanoramaSkyProperties,
  PhysicalSkyProperties,
  ProceduralSkyProperties,
  SkyProperties,
} from './types';
