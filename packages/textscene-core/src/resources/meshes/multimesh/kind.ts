/**
 * The MultiMesh a MultiMeshInstance3D holds, read through the resource module (ADR-0071) from a
 * SubResource or from a `.tres`. No THREE and no React.
 */

import { warn } from '../../../logger';
import type { ResourceKind, ScopedReference } from '../../reading';
import { decodeMultiMesh } from './decode';
import type { MultiMeshData } from './types';

/** A decoded MultiMesh and its `mesh` slot, which resolves in the tables of the file that wrote the MultiMesh. */
export interface HeldMultiMesh extends MultiMeshData {
  meshReference: ScopedReference;
}

export const MULTI_MESH: ResourceKind<HeldMultiMesh> = {
  name: 'MultiMesh',
  accepts: (type) => type === 'MultiMesh',
  decode: ({ properties }, follow) => {
    try {
      const multiMesh = decodeMultiMesh(properties);
      return { ...multiMesh, meshReference: follow.reference(multiMesh.mesh) };
    } catch (error) {
      warn(
        `[MultiMeshInstance3D] MultiMesh unreadable: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  },
};
