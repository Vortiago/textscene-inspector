/**
 * Barrel that imports every node-type folder for its self-registration
 * side effect. Importing this module is sufficient to populate
 * nodeComponentRegistry with the full MVS set of R3F node components.
 *
 * GenericNodeFallback is intentionally NOT registered — the recursive
 * dispatcher renders it explicitly when registry.get(typeName) returns
 * undefined.
 */

import '../../nodes/node/index.r3f';
import '../../nodes/base/node3d/index.r3f';
import '../../nodes/3d/meshinstance3d/index.r3f';
import '../../nodes/3d/csg/csgbox3d/index.r3f';
import '../../nodes/3d/csg/csgcylinder3d/index.r3f';
import '../../nodes/3d/camera3d/index.r3f';
import '../../nodes/3d/lights/directionallight3d/index.r3f';
import '../../nodes/3d/lights/omnilight3d/index.r3f';
import '../../nodes/3d/lights/spotlight3d/index.r3f';
import '../../nodes/3d/worldenvironment/index.r3f';
import '../../nodes/physics/3d/staticbody3d/index.r3f';
import '../../nodes/physics/3d/area3d/index.r3f';
import '../../nodes/audio/audiostreamplayer/index.r3f';
import '../../nodes/3d/label3d/index.r3f';
import '../../nodes/3d/sprite3d/index.r3f';
import '../../nodes/audio/audiostreamplayer3d/index.r3f';
import '../../nodes/animation/animationplayer/index.r3f';
import '../../nodes/animation/animationtree/index.r3f';
import '../internal/glb-scene-root/index';

export { GenericNodeFallback } from '../internal/generic-node-fallback/index';
