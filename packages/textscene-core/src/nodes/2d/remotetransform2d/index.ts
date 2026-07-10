/**
 * RemoteTransform2D registration — parser + property formatter.
 *
 * Non-visual: it pushes its transform to a remote Node2D but draws nothing
 * of its own, so the render component (index.r3f.ts) reuses the Node2D
 * transform-only group (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseRemoteTransform2D } from './parser';
import { formatRemoteTransform2DProperties } from './propertyFormatter';

const remoteTransform2DRegistration: NodeTypeRegistration = {
  typeName: 'RemoteTransform2D',
  parser: parseRemoteTransform2D,
  propertyFormatter: formatRemoteTransform2DProperties,
};

nodeRegistry.register(remoteTransform2DRegistration);

export { remoteTransform2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
