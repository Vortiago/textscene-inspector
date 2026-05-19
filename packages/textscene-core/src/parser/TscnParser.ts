/**
 * Parses Godot TSCN text files into a structured format.
 *
 * Uses TscnParserCore + NodeRegistry-based node creation. Each node
 * type's `index.ts` self-registers its parser + property formatter on
 * import; this file imports each one for its side effect so the parser
 * sees the full set of registrations.
 */

// Side-effect imports: each module registers its parser + formatter on load.
import '../nodes/node/index.js';
import '../nodes/base/node3d/index.js';
import '../nodes/3d/meshinstance3d/index.js';
import '../nodes/3d/camera3d/index.js';
import '../nodes/3d/label3d/index.js';
import '../nodes/3d/sprite3d/index.js';
import '../nodes/3d/lights/spotlight3d/index.js';
import '../nodes/3d/lights/directionallight3d/index.js';
import '../nodes/3d/lights/omnilight3d/index.js';
import '../nodes/3d/worldenvironment/index.js';

import type { TscnScene } from './types.js';
import { TscnParserCore } from './TscnParserCore.js';
import { parseNodeWithRegistry } from '../core/NodeRegistry.js';

/**
 * Lenient TSCN parser used for rendering.
 *
 * Strategy: recover from minor errors, log warnings, and keep rendering
 * whatever it can. For strict validation use `linter/StrictTscnParser`.
 */
export class TscnParser {
  private core = new TscnParserCore();

  /**
   * Parse TSCN content. Returns a scene with nodes whose `.properties`
   * have been converted from raw snake_case strings to the strongly-typed
   * shape declared by the relevant node-type module.
   */
  parse(content: string): TscnScene {
    return this.core.parse(content, parseNodeWithRegistry);
  }
}
