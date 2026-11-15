/** The NavigationMesh kind: the walkable surface of a NavigationRegion3D from any origin. */

import type { ResourceKind } from '../../reading';
import { decodeNavigationMesh } from './decode';
import type { NavigationMeshData } from './types';

export const NAVIGATION_MESH: ResourceKind<NavigationMeshData> = {
  name: 'NavigationMesh',
  accepts: (type) => type === 'NavigationMesh',
  decode: ({ properties }) => decodeNavigationMesh(properties),
};
