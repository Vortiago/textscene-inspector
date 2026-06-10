/**
 * AudioStreamPlayer2D registration — parser.
 *
 * Positional 2D audio node (extends Node2D): only the 2D transform matters
 * for the preview, so it reuses `parseNode2D` the way the 2D physics bodies
 * do (see nodes/physics/2d/index.ts). Audio-only properties (stream, volume,
 * attenuation) don't affect rendering and are left unparsed; the render
 * component (index.r3f.ts) reuses the Node2D transform group (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const audioStreamPlayer2DRegistration: NodeTypeRegistration = {
  typeName: 'AudioStreamPlayer2D',
  parser: parseNode2D,
};

nodeRegistry.register(audioStreamPlayer2DRegistration);

export { audioStreamPlayer2DRegistration };
