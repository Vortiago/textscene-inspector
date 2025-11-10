/**
 * Linter entry point - imports all lint rules and validators to trigger registration
 *
 * IMPORTANT: Uses index.linter.ts for all nodes to keep bundle size minimal.
 * This pattern prevents bundling THREE.js and renderer code in the linter CLI.
 */

// Import linter registration for all nodes via index.linter.ts
// This pattern is consistent for ALL nodes (with or without renderers)
import '../nodes/base/node3d/index.linter.js';
import '../nodes/base/node2d/index.linter.js';
import '../nodes/3d/meshinstance3d/index.linter.js';
import '../nodes/3d/lights/omnilight3d/index.linter.js';
import '../nodes/3d/lights/directionallight3d/index.linter.js';
import '../nodes/3d/lights/spotlight3d/index.linter.js';
import '../nodes/3d/camera3d/index.linter.js';
import '../nodes/3d/particles/gpuparticles3d/index.linter.js';
import '../nodes/3d/sprite3d/index.linter.js';
import '../nodes/3d/worldenvironment/index.linter.js';
import '../nodes/3d/skeleton3d/index.linter.js';
import '../nodes/2d/camera2d/index.linter.js';
import '../nodes/2d/sprite2d/index.linter.js';
import '../nodes/2d/animatedsprite2d/index.linter.js';
import '../nodes/animation/animationplayer/index.linter.js';
import '../nodes/animation/animationtree/index.linter.js';
import '../nodes/audio/audiostreamplayer2d/index.linter.js';
import '../nodes/audio/audiostreamplayer3d/index.linter.js';
import '../nodes/physics/2d/area2d/index.linter.js';
import '../nodes/physics/2d/characterbody2d/index.linter.js';
import '../nodes/physics/2d/collisionshape2d/index.linter.js';
import '../nodes/physics/2d/rigidbody2d/index.linter.js';
import '../nodes/physics/2d/staticbody2d/index.linter.js';
import '../nodes/physics/3d/area3d/index.linter.js';
import '../nodes/physics/3d/characterbody3d/index.linter.js';
import '../nodes/physics/3d/collisionshape3d/index.linter.js';
import '../nodes/physics/3d/rigidbody3d/index.linter.js';
import '../nodes/physics/3d/staticbody3d/index.linter.js';
import '../nodes/paths/path3d/index.linter.js';
import '../nodes/paths/pathfollow3d/index.linter.js';

// Import resource validators
import '../resources/materials/standardmaterial3d/linterParser.js';
import '../resources/environment/linterParser.js';

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
