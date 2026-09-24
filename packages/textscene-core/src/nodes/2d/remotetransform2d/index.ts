/**
 * Registers the RemoteTransform2D parser and property formatter. It draws
 * nothing, so index.r3f.ts reuses the Node2D transform-only group (ADR-0008).
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
