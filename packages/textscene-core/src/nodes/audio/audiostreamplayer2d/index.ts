/**
 * AudioStreamPlayer2D registration — parser + property formatter.
 *
 * Positional 2D audio node (extends Node2D): only the 2D transform matters
 * for the preview, so it reuses `parseNode2D` the way the 2D physics bodies
 * do (see nodes/physics/2d/index.ts). Audio-only properties (stream, volume,
 * attenuation) are now parsed by the dedicated parser; the render component
 * (index.r3f.ts) reuses the Node2D transform group (ADR-0008).
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
