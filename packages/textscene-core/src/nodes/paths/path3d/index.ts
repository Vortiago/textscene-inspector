/**
 * Path3D registration: the parser. Path3D draws a selection-gated Curve3D polyline gizmo
 * (ADR-0018) and provides the curve to PathFollow3D children.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parsePath3D } from './parser';

const path3DRegistration: NodeTypeRegistration = {
  typeName: 'Path3D',
  parser: parsePath3D,
};

nodeRegistry.register(path3DRegistration);

export { path3DRegistration };
export * from './parser';
export * from './types';
