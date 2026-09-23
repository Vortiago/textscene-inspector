/**
 * Marker3D parser registration: the Node3D transform plus `gizmo_extents`, for
 * the selection-gated cross gizmo (ADR-0018).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseMarker3D } from './parser';

const marker3DRegistration: NodeTypeRegistration = {
  typeName: 'Marker3D',
  parser: parseMarker3D,
};

nodeRegistry.register(marker3DRegistration);

export { marker3DRegistration };
export * from './parser';
export * from './types';
