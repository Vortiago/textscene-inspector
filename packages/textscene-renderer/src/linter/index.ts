/**
 * Linter entry point - imports all lint rules and validators to trigger registration
 */

// Import all linter parsers to trigger validator registration
import '../nodes/animation/animationplayer/linterParser.js';
import '../nodes/physics/2d/area2d/linterParser.js';
import '../nodes/physics/3d/area3d/linterParser.js';
import '../nodes/audio/audiostreamplayer2d/linterParser.js';
import '../nodes/audio/audiostreamplayer3d/linterParser.js';
import '../nodes/2d/camera2d/linterParser.js';
import '../nodes/3d/camera3d/linterParser.js';
import '../nodes/physics/2d/characterbody2d/linterParser.js';
import '../nodes/physics/3d/characterbody3d/linterParser.js';
import '../nodes/physics/2d/collisionshape2d/linterParser.js';
import '../nodes/physics/3d/collisionshape3d/linterParser.js';
import '../nodes/3d/lights/directionallight3d/linterParser.js';
import '../nodes/3d/particles/gpuparticles3d/linterParser.js';
import '../nodes/3d/meshinstance3d/linterParser.js';
import '../nodes/base/node2d/linterParser.js';
import '../nodes/base/node3d/linterParser.js';
import '../nodes/3d/lights/omnilight3d/linterParser.js';
import '../nodes/physics/2d/rigidbody2d/linterParser.js';
import '../nodes/physics/3d/rigidbody3d/linterParser.js';
import '../nodes/3d/lights/spotlight3d/linterParser.js';
import '../nodes/2d/sprite2d/linterParser.js';
import '../nodes/3d/sprite3d/linterParser.js';
import '../nodes/physics/2d/staticbody2d/linterParser.js';
import '../nodes/physics/3d/staticbody3d/linterParser.js';
import '../nodes/3d/worldenvironment/linterParser.js';

// Import all linter rules to trigger self-registration
import '../nodes/animation/animationplayer/linter.js';
import '../nodes/physics/2d/area2d/linter.js';
import '../nodes/physics/3d/area3d/linter.js';
import '../nodes/audio/audiostreamplayer2d/linter.js';
import '../nodes/audio/audiostreamplayer3d/linter.js';
import '../nodes/2d/camera2d/linter.js';
import '../nodes/3d/camera3d/linter.js';
import '../nodes/physics/2d/characterbody2d/linter.js';
import '../nodes/physics/3d/characterbody3d/linter.js';
import '../nodes/physics/2d/collisionshape2d/linter.js';
import '../nodes/physics/3d/collisionshape3d/linter.js';
import '../nodes/3d/lights/directionallight3d/linter.js';
import '../nodes/3d/particles/gpuparticles3d/linter.js';
import '../nodes/3d/meshinstance3d/linter.js';
import '../nodes/base/node2d/linter.js';
import '../nodes/base/node3d/linter.js';
import '../nodes/3d/lights/omnilight3d/linter.js';
import '../nodes/physics/2d/rigidbody2d/linter.js';
import '../nodes/physics/3d/rigidbody3d/linter.js';
import '../nodes/3d/lights/spotlight3d/linter.js';
import '../nodes/2d/sprite2d/linter.js';
import '../nodes/3d/sprite3d/linter.js';
import '../nodes/physics/2d/staticbody2d/linter.js';
import '../nodes/physics/3d/staticbody3d/linter.js';
import '../nodes/3d/worldenvironment/linter.js';

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
