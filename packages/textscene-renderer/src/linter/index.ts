/**
 * Linter entry point - imports all lint rules and validators to trigger registration
 */

// Import all linter parsers to trigger validator registration
import '../nodes/animationplayer/linterParser.js';
import '../nodes/area2d/linterParser.js';
import '../nodes/area3d/linterParser.js';
import '../nodes/audiostreamplayer2d/linterParser.js';
import '../nodes/audiostreamplayer3d/linterParser.js';
import '../nodes/camera2d/linterParser.js';
import '../nodes/camera3d/linterParser.js';
import '../nodes/characterbody2d/linterParser.js';
import '../nodes/characterbody3d/linterParser.js';
import '../nodes/collisionshape2d/linterParser.js';
import '../nodes/collisionshape3d/linterParser.js';
import '../nodes/directionallight3d/linterParser.js';
import '../nodes/gpuparticles3d/linterParser.js';
import '../nodes/meshinstance3d/linterParser.js';
import '../nodes/node2d/linterParser.js';
import '../nodes/node3d/linterParser.js';
import '../nodes/omnilight3d/linterParser.js';
import '../nodes/rigidbody2d/linterParser.js';
import '../nodes/rigidbody3d/linterParser.js';
import '../nodes/spotlight3d/linterParser.js';
import '../nodes/sprite2d/linterParser.js';
import '../nodes/sprite3d/linterParser.js';
import '../nodes/staticbody2d/linterParser.js';
import '../nodes/staticbody3d/linterParser.js';
import '../nodes/worldenvironment/linterParser.js';

// Import all linter rules to trigger self-registration
import '../nodes/animationplayer/linter.js';
import '../nodes/area2d/linter.js';
import '../nodes/area3d/linter.js';
import '../nodes/audiostreamplayer2d/linter.js';
import '../nodes/audiostreamplayer3d/linter.js';
import '../nodes/camera2d/linter.js';
import '../nodes/camera3d/linter.js';
import '../nodes/characterbody2d/linter.js';
import '../nodes/characterbody3d/linter.js';
import '../nodes/collisionshape2d/linter.js';
import '../nodes/collisionshape3d/linter.js';
import '../nodes/directionallight3d/linter.js';
import '../nodes/gpuparticles3d/linter.js';
import '../nodes/meshinstance3d/linter.js';
import '../nodes/node2d/linter.js';
import '../nodes/node3d/linter.js';
import '../nodes/omnilight3d/linter.js';
import '../nodes/rigidbody2d/linter.js';
import '../nodes/rigidbody3d/linter.js';
import '../nodes/spotlight3d/linter.js';
import '../nodes/sprite2d/linter.js';
import '../nodes/sprite3d/linter.js';
import '../nodes/staticbody2d/linter.js';
import '../nodes/staticbody3d/linter.js';
import '../nodes/worldenvironment/linter.js';

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
