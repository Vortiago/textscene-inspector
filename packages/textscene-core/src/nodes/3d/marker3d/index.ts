/**
 * Marker3D parser registration: the Node3D transform plus `gizmo_extents`, for
 * the cross gizmo (ADR-0056).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseMarker3D } from './parser';

const marker3DRegistration: NodeTypeRegistration = {
  typeName: 'Marker3D',
  parser: parseMarker3D,
};

nodeRegistry.register(marker3DRegistration);

export * from './parser';
export * from './types';
