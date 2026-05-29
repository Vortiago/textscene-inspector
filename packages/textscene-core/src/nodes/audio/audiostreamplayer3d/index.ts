/**
 * AudioStreamPlayer3D registration — parser + property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAudioStreamPlayer3D, isAudioStreamPlayer3D } from './parser';
import { formatAudioStreamPlayer3DProperties } from './propertyFormatter';

const audioStreamPlayer3DRegistration: NodeTypeRegistration = {
  typeName: 'AudioStreamPlayer3D',
  typeGuard: isAudioStreamPlayer3D,
  parser: parseAudioStreamPlayer3D,
  propertyFormatter: formatAudioStreamPlayer3DProperties,
};

nodeRegistry.register(audioStreamPlayer3DRegistration);

export { audioStreamPlayer3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
