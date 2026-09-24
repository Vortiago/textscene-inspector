/**
 * AudioStreamPlayer registration: parser and property formatter. A non-spatial audio node (extends
 * Node) with no visual representation, so index.r3f.ts reuses the base Node component rather than
 * the grey GenericNodeFallback cube.
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
