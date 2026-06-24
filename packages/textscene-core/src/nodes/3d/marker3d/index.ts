/**
 * Marker3D registration — parser.
 *
 * Draws a selection-gated 3-axis cross gizmo (ADR-0018); the Node3D transform is
 * parsed plus `gizmo_extents`. Previously transform-only (ADR-0008).
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
