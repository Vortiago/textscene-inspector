/**
 * AudioStreamPlayer registration — parser + property formatter.
 *
 * Non-spatial audio node (extends Node, not Node3D). It has no visual
 * representation, so the render component (index.r3f.ts) reuses the base
 * Node component so it renders nothing visible (rather than the gray
 * GenericNodeFallback cube).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAudioStreamPlayer } from './parser';
import { formatAudioStreamPlayerProperties } from './propertyFormatter';

const audioStreamPlayerRegistration: NodeTypeRegistration = {
  typeName: 'AudioStreamPlayer',
  parser: parseAudioStreamPlayer,
  propertyFormatter: formatAudioStreamPlayerProperties,
};

nodeRegistry.register(audioStreamPlayerRegistration);

export { audioStreamPlayerRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
