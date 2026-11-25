import type { Formatter } from './inspectedNode';
import { formatAnimatedSprite2DProperties } from './2d/animatedsprite2d/propertyFormatter';
import { formatAnimationPlayerProperties } from './animation/animationplayer/propertyFormatter';
import { formatAnimationTreeProperties } from './animation/animationtree/propertyFormatter';
import { formatArea2DProperties } from './physics/2d/area2d/propertyFormatter';
import { formatAreaLight3DProperties } from './3d/lights/arealight3d/propertyFormatter';
import { formatAudioStreamPlayerProperties } from './audio/audiostreamplayer/propertyFormatter';
import { formatAudioStreamPlayer2DProperties } from './audio/audiostreamplayer2d/propertyFormatter';
import { formatAudioStreamPlayer3DProperties } from './audio/audiostreamplayer3d/propertyFormatter';
import { formatCPUParticles2DProperties } from './2d/cpuparticles2d/propertyFormatter';
import { formatCamera2DProperties } from './2d/camera2d/propertyFormatter';
import { formatCamera3DProperties } from './3d/camera3d/propertyFormatter';
import { formatDecalProperties } from './3d/decal/propertyFormatter';
import { formatDirectionalLight2DProperties } from './2d/directionallight2d/propertyFormatter';
import { formatDirectionalLight3DProperties } from './3d/lights/directionallight3d/propertyFormatter';
import { formatLabel3DProperties } from './3d/label3d/propertyFormatter';
import { formatLine2DProperties } from './2d/line2d/propertyFormatter';
import { formatMeshInstance2DProperties } from './2d/meshinstance2d/propertyFormatter';
import { formatMeshInstance3DProperties } from './3d/meshinstance3d/propertyFormatter';
import { formatMultiMeshInstance2DProperties } from './2d/multimeshinstance2d/propertyFormatter';
import { formatNavigationAgent3DProperties } from './3d/navigationagent3d/propertyFormatter';
import { formatNavigationObstacle3DProperties } from './3d/navigationobstacle3d/propertyFormatter';
import { formatNode2DProperties } from './base/node2d/propertyFormatter';
import { formatNode3DProperties } from './base/node3d/propertyFormatter';
import { formatOmniLight3DProperties } from './3d/lights/omnilight3d/propertyFormatter';
import { formatPointLight2DProperties } from './2d/pointlight2d/propertyFormatter';
import { formatPolygon2DProperties } from './2d/polygon2d/propertyFormatter';
import { formatRemoteTransform2DProperties } from './2d/remotetransform2d/propertyFormatter';
import { formatRemoteTransform3DProperties } from './3d/remotetransform3d/propertyFormatter';
import { formatSkeleton3DProperties } from './3d/skeleton3d/propertyFormatter';
import { formatSpotLight3DProperties } from './3d/lights/spotlight3d/propertyFormatter';
import { formatSprite2DProperties } from './2d/sprite2d/propertyFormatter';
import { formatSprite3DProperties } from './3d/sprite3d/propertyFormatter';
import { formatTileMapProperties } from './2d/tiles/tilemap/propertyFormatter';
import { formatTileMapLayerProperties } from './2d/tiles/tilemaplayer/propertyFormatter';
import { formatTimerProperties } from './timers/timer/propertyFormatter';
import { formatVehicleWheel3DProperties } from './physics/3d/vehiclewheel3d/propertyFormatter';
import { formatWorldEnvironmentProperties } from './3d/worldenvironment/propertyFormatter';

/** The inspector sections of each class that has its own, by exact class name. */
const FORMATTERS: ReadonlyMap<string, Formatter> = new Map<string, Formatter>([
  ['AnimatedSprite2D', formatAnimatedSprite2DProperties],
  ['AnimationPlayer', formatAnimationPlayerProperties],
  ['AnimationTree', formatAnimationTreeProperties],
  ['Area2D', formatArea2DProperties],
  ['AreaLight3D', formatAreaLight3DProperties],
  ['AudioStreamPlayer', formatAudioStreamPlayerProperties],
  ['AudioStreamPlayer2D', formatAudioStreamPlayer2DProperties],
  ['AudioStreamPlayer3D', formatAudioStreamPlayer3DProperties],
  ['CPUParticles2D', formatCPUParticles2DProperties],
  ['Camera2D', formatCamera2DProperties],
  ['Camera3D', formatCamera3DProperties],
  ['Decal', formatDecalProperties],
  ['DirectionalLight2D', formatDirectionalLight2DProperties],
  ['DirectionalLight3D', formatDirectionalLight3DProperties],
  ['Label3D', formatLabel3DProperties],
  ['Line2D', formatLine2DProperties],
  ['MeshInstance2D', formatMeshInstance2DProperties],
  ['MeshInstance3D', formatMeshInstance3DProperties],
  ['MultiMeshInstance2D', formatMultiMeshInstance2DProperties],
  ['NavigationAgent3D', formatNavigationAgent3DProperties],
  ['NavigationObstacle3D', formatNavigationObstacle3DProperties],
  ['Node2D', formatNode2DProperties],
  ['Node3D', formatNode3DProperties],
  ['OmniLight3D', formatOmniLight3DProperties],
  ['PointLight2D', formatPointLight2DProperties],
  ['Polygon2D', formatPolygon2DProperties],
  ['RemoteTransform2D', formatRemoteTransform2DProperties],
  ['RemoteTransform3D', formatRemoteTransform3DProperties],
  ['Skeleton3D', formatSkeleton3DProperties],
  ['SpotLight3D', formatSpotLight3DProperties],
  ['Sprite2D', formatSprite2DProperties],
  ['Sprite3D', formatSprite3DProperties],
  ['TileMap', formatTileMapProperties],
  ['TileMapLayer', formatTileMapLayerProperties],
  ['Timer', formatTimerProperties],
  ['VehicleWheel3D', formatVehicleWheel3DProperties],
  ['WorldEnvironment', formatWorldEnvironmentProperties],
]);

/** The formatter of `className`, or undefined for a class with no sections of its own. */
export function formatterOf(className: string): Formatter | undefined {
  return FORMATTERS.get(className);
}
