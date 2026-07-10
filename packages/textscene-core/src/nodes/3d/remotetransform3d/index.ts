/**
 * RemoteTransform3D registration — parser + property formatter.
 *
 * Non-visual: it pushes its transform to a remote Node3D but draws nothing
 * of its own, so the render component (index.r3f.ts) reuses the Node3D
 * transform-only group (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseRemoteTransform3D } from './parser';
import { formatRemoteTransform3DProperties } from './propertyFormatter';

const remoteTransform3DRegistration: NodeTypeRegistration = {
  typeName: 'RemoteTransform3D',
  parser: parseRemoteTransform3D,
  propertyFormatter: formatRemoteTransform3DProperties,
};

nodeRegistry.register(remoteTransform3DRegistration);

export { remoteTransform3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
