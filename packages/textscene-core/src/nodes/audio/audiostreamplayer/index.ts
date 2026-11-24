/**
 * AudioStreamPlayer registration: parser and property formatter. A non-spatial audio node (extends
 * Node) with no visual representation, so index.r3f.ts reuses the base Node component rather than
 * the grey GenericNodeFallback cube.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAudioStreamPlayer } from './parser';

const audioStreamPlayerRegistration: NodeTypeRegistration = {
  typeName: 'AudioStreamPlayer',
  parser: parseAudioStreamPlayer,
};

nodeRegistry.register(audioStreamPlayerRegistration);

export * from './parser';
export * from './types';
