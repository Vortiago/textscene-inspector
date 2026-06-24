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
import '../nodes/3d/csg/csgbox3d/index.js';
import '../nodes/3d/csg/csgcylinder3d/index.js';
import '../nodes/3d/csg/csgsphere3d/index.js';
import '../nodes/3d/camera3d/index.js';
import '../nodes/3d/label3d/index.js';
import '../nodes/3d/sprite3d/index.js';
import '../nodes/audio/audiostreamplayer3d/index.js';
import '../nodes/animation/animationplayer/index.js';
import '../nodes/animation/animationtree/index.js';
import '../nodes/3d/lights/spotlight3d/index.js';
import '../nodes/3d/lights/directionallight3d/index.js';
import '../nodes/3d/lights/omnilight3d/index.js';
import '../nodes/3d/worldenvironment/index.js';
import '../nodes/physics/3d/staticbody3d/index.js';
import '../nodes/physics/3d/area3d/index.js';
import '../nodes/physics/3d/collisionshape3d/index.js';
// Non-visual nodes — transform-only groups, no own geometry (ADR-0008).
import '../nodes/physics/3d/characterbody3d/index.js';
import '../nodes/physics/3d/rigidbody3d/index.js';
import '../nodes/3d/skeleton3d/index.js';
import '../nodes/3d/particles/gpuparticles3d/index.js';
import '../nodes/3d/marker3d/index.js';
import '../nodes/3d/gridmap/index.js';
import '../nodes/3d/navigationregion3d/index.js';
import '../nodes/3d/decal/index.js';
import '../nodes/paths/path3d/index.js';
import '../nodes/paths/pathfollow3d/index.js';
import '../nodes/audio/audiostreamplayer/index.js';
import '../nodes/audio/audiostreamplayer2d/index.js';
import '../nodes/2d/ui/control/index.js';
import '../nodes/2d/ui/colorrect/index.js';
import '../nodes/2d/ui/label/index.js';
import '../nodes/2d/ui/vboxcontainer/index.js';
import '../nodes/2d/ui/hboxcontainer/index.js';
import '../nodes/2d/ui/gridcontainer/index.js';
import '../nodes/2d/ui/centercontainer/index.js';
import '../nodes/2d/ui/margincontainer/index.js';
import '../nodes/2d/ui/scrollcontainer/index.js';
import '../nodes/2d/ui/panel/index.js';
import '../nodes/2d/ui/panelcontainer/index.js';
import '../nodes/2d/ui/button/index.js';
import '../nodes/2d/ui/texturerect/index.js';
import '../nodes/2d/ui/richtextlabel/index.js';
import '../nodes/2d/ui/canvaslayer/index.js';
import '../nodes/base/node2d/index.js';
import '../nodes/2d/sprite2d/index.js';
import '../nodes/2d/polygon2d/index.js';
import '../nodes/2d/camera2d/index.js';
import '../nodes/2d/animatedsprite2d/index.js';
import '../nodes/physics/2d/index.js';
import '../nodes/2d/tiles/tilemaplayer/index.js';
import '../nodes/2d/tiles/tilemap/index.js';
import '../nodes/2d/navigationregion2d/index.js';
import '../nodes/2d/marker2d/index.js';
import '../nodes/2d/path2d/index.js';
import '../nodes/2d/pathfollow2d/index.js';

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
