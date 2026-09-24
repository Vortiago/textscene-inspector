/**
 * AudioStreamPlayer2D registration: parser and property formatter. A positional 2D audio node
 * (extends Node2D) whose render component reuses the Node2D transform group (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAudioStreamPlayer2D } from './parser';
import { formatAudioStreamPlayer2DProperties } from './propertyFormatter';

const audioStreamPlayer2DRegistration: NodeTypeRegistration = {
  typeName: 'AudioStreamPlayer2D',
  parser: parseAudioStreamPlayer2D,
  propertyFormatter: formatAudioStreamPlayer2DProperties,
};

nodeRegistry.register(audioStreamPlayer2DRegistration);

export { audioStreamPlayer2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
