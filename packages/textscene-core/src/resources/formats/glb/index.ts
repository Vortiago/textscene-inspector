/**
 * GLB / glTF resource slice, foreign-format kind (ADR-0031). The parser is three's
 * `GLTFLoader`, since a `.glb` never arrives as a **ParsedResource** section. This index
 * imports neither `glbProcessing.ts` nor `rootScale.ts`, so the linter and a host's
 * provider read the claim table without pulling in a renderer.
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
