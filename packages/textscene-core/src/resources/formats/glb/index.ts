/**
 * GLB / glTF resource slice — foreign-format kind (ADR-0031).
 *
 * The real parser is three's `GLTFLoader`, declared openly instead of split
 * into `decode.ts` + `build.ts`: a `.glb` arrives as bytes, never as a
 * **ParsedResource** section, so that split would be a fiction here.
 *
 * The THREE-touching implementation sits beside this file — `glbProcessing.ts`
 * (lazy loader modules, parse, per-consumer clone) and `rootScale.ts` (the
 * **Import sidecar** correction, ADR-0028) — and this index imports neither:
 * the claim table must stay readable from the linter and from a host's
 * provider without pulling a renderer into the import closure.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'glb',
  kind: 'foreign-format',
  // `GLBMesh` is this previewer's own request tag for a `.glb`/`.gltf` a scene
  // instances; `GLB`/`GLTF` are the type names an ext_resource can carry.
  typeNames: ['GLB', 'GLTF', 'GLBMesh'],
  extensions: ['.glb', '.gltf'],
  binaryBytes: true,
  // A loaded glTF is one Object3D tree; two consumers of the same file each need
  // their own, or the second mount reparents the first's.
  clonePerConsumer: true,
  busType: 'glb',
  failureLabel: 'Node using GLB mesh',
});

export type { RootScale } from './types';
