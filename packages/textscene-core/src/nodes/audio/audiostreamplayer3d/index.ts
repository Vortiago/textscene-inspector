/**
 * AudioStreamPlayer3D registration: parser and property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAudioStreamPlayer3D } from './parser';

const audioStreamPlayer3DRegistration: NodeTypeRegistration = {
  typeName: 'AudioStreamPlayer3D',
  parser: parseAudioStreamPlayer3D,
};

nodeRegistry.register(audioStreamPlayer3DRegistration);

export * from './parser';
export * from './types';
