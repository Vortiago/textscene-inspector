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
import '../../nodes/3d/csg/csgsphere3d/index.r3f';
import '../../nodes/3d/camera3d/index.r3f';
import '../../nodes/3d/lights/directionallight3d/index.r3f';
import '../../nodes/3d/lights/omnilight3d/index.r3f';
import '../../nodes/3d/lights/spotlight3d/index.r3f';
import '../../nodes/3d/lights/arealight3d/index.r3f';
import '../../nodes/3d/worldenvironment/index.r3f';
import '../../nodes/physics/3d/staticbody3d/index.r3f';
import '../../nodes/physics/3d/area3d/index.r3f';
import '../../nodes/physics/3d/collisionshape3d/index.r3f';
// Non-visual nodes — transform-only groups (ADR-0008).
import '../../nodes/physics/3d/characterbody3d/index.r3f';
import '../../nodes/physics/3d/rigidbody3d/index.r3f';
import '../../nodes/3d/skeleton3d/index.r3f';
import '../../nodes/3d/particles/gpuparticles3d/index.r3f';
import '../../nodes/paths/path3d/index.r3f';
import '../../nodes/paths/pathfollow3d/index.r3f';
import '../../nodes/audio/audiostreamplayer/index.r3f';
import '../../nodes/audio/audiostreamplayer2d/index.r3f';
import '../../nodes/3d/label3d/index.r3f';
import '../../nodes/3d/sprite3d/index.r3f';
import '../../nodes/3d/marker3d/index.r3f';
import '../../nodes/3d/gridmap/index.r3f';
import '../../nodes/3d/navigationregion3d/index.r3f';
import '../../nodes/3d/decal/index.r3f';
import '../../nodes/3d/remotetransform3d/index.r3f';
import '../../nodes/3d/navigationagent3d/index.r3f';
import '../../nodes/3d/navigationobstacle3d/index.r3f';
import '../../nodes/audio/audiostreamplayer3d/index.r3f';
import '../../nodes/animation/animationplayer/index.r3f';
import '../../nodes/animation/animationtree/index.r3f';
import '../../nodes/base/node2d/index.r3f';
import '../../nodes/2d/sprite2d/index.r3f';
import '../../nodes/2d/polygon2d/index.r3f';
import '../../nodes/2d/camera2d/index.r3f';
import '../../nodes/2d/animatedsprite2d/index.r3f';
import '../../nodes/physics/2d/index.r3f';
import '../../nodes/physics/2d/area2d/index.r3f';
import '../../nodes/physics/2d/collisionshape2d/index.r3f';
import '../internal/glb-scene-root/index';
import '../../nodes/2d/tiles/tilemaplayer/index.r3f';
import '../../nodes/2d/tiles/tilemap/index.r3f';
import '../../nodes/2d/navigationregion2d/index.r3f';
import '../../nodes/2d/marker2d/index.r3f';
import '../../nodes/2d/path2d/index.r3f';
import '../../nodes/2d/pathfollow2d/index.r3f';
import '../../nodes/2d/line2d/index.r3f';
import '../../nodes/2d/remotetransform2d/index.r3f';
import '../../nodes/timers/timer/index.r3f';

export { GenericNodeFallback } from '../internal/generic-node-fallback/index';
