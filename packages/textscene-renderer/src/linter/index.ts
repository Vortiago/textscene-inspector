/**
 * Linter entry point - imports all lint rules and validators to trigger registration
 */

// Import nodes with renderers (triggers both renderer AND linter registration via index.ts)
import '../nodes/base/node3d/index.js';
import '../nodes/3d/meshinstance3d/index.js';
import '../nodes/3d/lights/omnilight3d/index.js';
import '../nodes/3d/lights/directionallight3d/index.js';
import '../nodes/3d/lights/spotlight3d/index.js';

// Import linter-only nodes (not yet implemented for rendering)
// These nodes only have linter.ts and linterParser.ts, no index.ts
import '../nodes/animation/animationplayer/linterParser.js';
import '../nodes/animation/animationplayer/linter.js';
import '../nodes/physics/2d/area2d/linterParser.js';
import '../nodes/physics/2d/area2d/linter.js';
import '../nodes/physics/3d/area3d/linterParser.js';
import '../nodes/physics/3d/area3d/linter.js';
import '../nodes/audio/audiostreamplayer2d/linterParser.js';
import '../nodes/audio/audiostreamplayer2d/linter.js';
import '../nodes/audio/audiostreamplayer3d/linterParser.js';
import '../nodes/audio/audiostreamplayer3d/linter.js';
import '../nodes/2d/camera2d/linterParser.js';
import '../nodes/2d/camera2d/linter.js';
import '../nodes/3d/camera3d/linterParser.js';
import '../nodes/3d/camera3d/linter.js';
import '../nodes/physics/2d/characterbody2d/linterParser.js';
import '../nodes/physics/2d/characterbody2d/linter.js';
import '../nodes/physics/3d/characterbody3d/linterParser.js';
import '../nodes/physics/3d/characterbody3d/linter.js';
import '../nodes/physics/2d/collisionshape2d/linterParser.js';
import '../nodes/physics/2d/collisionshape2d/linter.js';
import '../nodes/physics/3d/collisionshape3d/linterParser.js';
import '../nodes/physics/3d/collisionshape3d/linter.js';
import '../nodes/3d/particles/gpuparticles3d/linterParser.js';
import '../nodes/3d/particles/gpuparticles3d/linter.js';
import '../nodes/base/node2d/linterParser.js';
import '../nodes/base/node2d/linter.js';
import '../nodes/physics/2d/rigidbody2d/linterParser.js';
import '../nodes/physics/2d/rigidbody2d/linter.js';
import '../nodes/physics/3d/rigidbody3d/linterParser.js';
import '../nodes/physics/3d/rigidbody3d/linter.js';
import '../nodes/2d/sprite2d/linterParser.js';
import '../nodes/2d/sprite2d/linter.js';
import '../nodes/3d/sprite3d/linterParser.js';
import '../nodes/3d/sprite3d/linter.js';
import '../nodes/physics/2d/staticbody2d/linterParser.js';
import '../nodes/physics/2d/staticbody2d/linter.js';
import '../nodes/physics/3d/staticbody3d/linterParser.js';
import '../nodes/physics/3d/staticbody3d/linter.js';
import '../nodes/3d/worldenvironment/linterParser.js';
import '../nodes/3d/worldenvironment/linter.js';
import '../nodes/animation/animationtree/linterParser.js';
import '../nodes/animation/animationtree/linter.js';
import '../nodes/3d/skeleton3d/linterParser.js';
import '../nodes/3d/skeleton3d/linter.js';
import '../nodes/paths/path3d/linterParser.js';
import '../nodes/paths/path3d/linter.js';
import '../nodes/paths/pathfollow3d/linterParser.js';
import '../nodes/paths/pathfollow3d/linter.js';

// Re-export core linter classes
export { Linter } from './Linter.js';
export { StrictTscnParser } from './StrictTscnParser.js';
export { validatorRegistry } from './ValidatorRegistry.js';
export { ruleRegistry } from './RuleRegistry.js';

// Re-export types
export type {
  Diagnostic,
  Severity,
  LintRule,
  RuleContext,
  RuleMeta,
  ParseError,
  StrictParseResult,
} from './types.js';
export type { PropertyValidator } from './ValidatorRegistry.js';
