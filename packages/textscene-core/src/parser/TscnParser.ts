/**
 * Parses Godot TSCN text files into a structured format for rendering.
 *
 * Uses TscnParserCore with NodeRegistry-based node creation for three.js rendering.
 */

// Register node types (triggers side-effect imports for renderers and parsers)
import '../nodes/node/index.renderer.js';
import '../nodes/base/node3d/index.renderer.js';
import '../nodes/3d/meshinstance3d/index.renderer.js';
import '../nodes/3d/camera3d/index.renderer.js';
import '../nodes/3d/lights/spotlight3d/index.renderer.js';
import '../nodes/3d/lights/directionallight3d/index.renderer.js';
import '../nodes/3d/lights/omnilight3d/index.renderer.js';

import type { TscnScene } from './types.js';
import { TscnParserCore } from './TscnParserCore.js';
import { parseNodeWithRegistry } from '../core/NodeRegistry.js';

/**
 * TSCN Parser for rendering
 * Uses NodeRegistry to create nodes with three.js rendering capabilities
 */
export class TscnParser {
  private core = new TscnParserCore();

  /**
   * Parse TSCN content for rendering
   * @param content - Raw TSCN file content
   * @returns Parsed scene with nodes ready for three.js rendering
   */
  parse(content: string): TscnScene {
    // Use core parser with NodeRegistry-based node creation
    return this.core.parse(content, parseNodeWithRegistry);
  }
}
