/**
 * Linter entry point - imports all lint rules and validators to trigger registration
 *
 * IMPORTANT: Uses index.linter.ts for all nodes to keep bundle size minimal.
 * This pattern prevents bundling THREE.js and renderer code in the linter CLI.
 */

// Import linter registration for all nodes via index.linter.ts
// This pattern is consistent for ALL nodes (with or without renderers)
//
// The base Control slice (nodes/2d/ui/control) registers the layout/anchor/
// offset + theme-override validators shared by the whole 2D UI family; every
// Control subclass inherits them through the ValidatorRegistry base-walk (#143,
// see linter/nodeBaseTypes.ts). The individual Control subclass slices remain
// render-only (ADR-0003) — they carry no index.linter.ts of their own unless
// they gain type-specific validators or semantic rules.
import '../nodes/node/index.linter.js';
import '../nodes/2d/ui/control/index.linter.js';
import '../nodes/2d/ui/subviewportcontainer/index.linter.js';
import '../nodes/2d/ui/hslider/index.linter.js';
import '../nodes/2d/ui/vslider/index.linter.js';
import '../nodes/viewport/subviewport/index.linter.js';
import '../nodes/base/node3d/index.linter.js';
import '../nodes/base/node2d/index.linter.js';
import '../nodes/3d/meshinstance3d/index.linter.js';
import '../nodes/3d/csg/csgbox3d/index.linter.js';
import '../nodes/3d/csg/csgcylinder3d/index.linter.js';
import '../nodes/3d/csg/csgsphere3d/index.linter.js';
import '../nodes/3d/csg/csgtorus3d/index.linter.js';
import '../nodes/3d/csg/csgcombiner3d/index.linter.js';
import '../nodes/3d/csg/csgmesh3d/index.linter.js';
import '../nodes/3d/csg/csgpolygon3d/index.linter.js';
import '../nodes/3d/lights/omnilight3d/index.linter.js';
import '../nodes/3d/lights/directionallight3d/index.linter.js';
import '../nodes/3d/lights/spotlight3d/index.linter.js';
import '../nodes/3d/lights/arealight3d/index.linter.js';
import '../nodes/3d/camera3d/index.linter.js';
import '../nodes/3d/label3d/index.linter.js';
import '../nodes/3d/particles/gpuparticles3d/index.linter.js';
import '../nodes/3d/sprite3d/index.linter.js';
import '../nodes/3d/worldenvironment/index.linter.js';
import '../nodes/3d/skeleton3d/index.linter.js';
import '../nodes/3d/decal/index.linter.js';
import '../nodes/3d/navigationregion3d/index.linter.js';
import '../nodes/3d/gridmap/index.linter.js';
import '../nodes/2d/camera2d/index.linter.js';
import '../nodes/2d/navigationregion2d/index.linter.js';
import '../nodes/2d/sprite2d/index.linter.js';
import '../nodes/2d/polygon2d/index.linter.js';
import '../nodes/2d/animatedsprite2d/index.linter.js';
import '../nodes/2d/marker2d/index.linter.js';
import '../nodes/2d/path2d/index.linter.js';
import '../nodes/2d/line2d/index.linter.js';
import '../nodes/2d/pathfollow2d/index.linter.js';
import '../nodes/2d/canvasmodulate/index.linter.js';
import '../nodes/2d/lightoccluder2d/index.linter.js';
import '../nodes/2d/pointlight2d/index.linter.js';
import '../nodes/2d/cpuparticles2d/index.linter.js';

import '../nodes/animation/animationplayer/index.linter.js';
import '../nodes/animation/animationtree/index.linter.js';
import '../nodes/audio/audiostreamplayer/index.linter.js';
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
import '../nodes/physics/3d/vehiclebody3d/index.linter.js';
import '../nodes/physics/3d/vehiclewheel3d/index.linter.js';
import '../nodes/3d/marker3d/index.linter.js';
import '../nodes/3d/remotetransform3d/index.linter.js';
import '../nodes/3d/navigationagent3d/index.linter.js';
import '../nodes/3d/navigationobstacle3d/index.linter.js';
import '../nodes/paths/path3d/index.linter.js';
import '../nodes/paths/pathfollow3d/index.linter.js';

// Import resource validators
import '../resources/materials/standardmaterial3d/linterValidators.js';
import '../resources/environment/index.linter.js';
import '../resources/meshes/planemesh/linterValidators.js';
import '../resources/meshes/quadmesh/linterValidators.js';
import '../nodes/2d/tiles/tilemaplayer/index.linter.js';
import '../nodes/2d/tiles/tilemap/index.linter.js';
import '../nodes/2d/remotetransform2d/index.linter.js';
import '../nodes/2d/parallaxlayer/index.linter.js';
import '../nodes/2d/parallaxbackground/index.linter.js';
import '../nodes/timers/timer/index.linter.js';

// Re-export core linter classes
export { Linter } from './Linter.js';
export { StrictTscnParser } from './StrictTscnParser.js';
export { validatorRegistry } from './ValidatorRegistry.js';
export { ruleRegistry } from './RuleRegistry.js';
export { SEVERITY_ORDER } from './types.js';

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
