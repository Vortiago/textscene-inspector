/**
 * RemoteTransform3D registration: parser + property formatter.
 *
 * Non-visual: it pushes its transform to a remote Node3D but draws nothing
 * of its own, so the render component (index.r3f.ts) reuses the Node3D
 * transform-only group (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseRemoteTransform3D } from './parser';

const remoteTransform3DRegistration: NodeTypeRegistration = {
  typeName: 'RemoteTransform3D',
  parser: parseRemoteTransform3D,
};

nodeRegistry.register(remoteTransform3DRegistration);

export * from './parser';
export * from './types';
