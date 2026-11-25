/**
 * Registers the RemoteTransform2D parser and property formatter. It draws
 * nothing, so index.r3f.ts reuses the Node2D transform-only group (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseRemoteTransform2D } from './parser';

const remoteTransform2DRegistration: NodeTypeRegistration = {
  typeName: 'RemoteTransform2D',
  parser: parseRemoteTransform2D,
};

nodeRegistry.register(remoteTransform2DRegistration);

export * from './parser';
export * from './types';
