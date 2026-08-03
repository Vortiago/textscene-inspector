/**
 * Sky resource slice entry point (ADR-0031): the routing claims plus the decode
 * surface. THREE-free and React-free.
 *
 * ONE slice for four type names, because they are one decode: `Sky` is the
 * indirection every `Environment.sky` points at, and the three materials are
 * the variants its `sky_material` resolves to. Splitting them would put the
 * "follow `sky_material`" step outside any slice, which is where it lived
 * before — spelled out inline in the WorldEnvironment hook.
 *
 * The claims route all four to the generic `resource` slot. That is a routing
 * FIX for the materials: the substring rule this replaces sent every type name
 * containing "Material" to the material processor, whose `BUILDABLE_MATERIAL_TYPES`
 * gate holds only `StandardMaterial3D` and `ShaderMaterial` and throws on
 * anything else. So an `ext_resource` `ProceduralSkyMaterial.tres` failed there
 * and never reached the `resource` slot its only consumer subscribes to
 * (`useSubOrExtResource`) — a working decode behind a permanent
 * missing-resources row, the defect class ADR-0031 cites for
 * `CanvasItemMaterial`. `Sky` itself was unaffected: it matches no substring, so
 * it fell through to the both-buses `.tres` branch.
 */

import { registerResourceSlice } from '../sliceRegistration';

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
