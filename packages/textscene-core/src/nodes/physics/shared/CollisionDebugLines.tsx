/**
 * Line segments in the collision debug colour at its alpha, as Godot's physics gizmo plugins draw
 * them (`scene_tree.cpp:2028`). The caller mounts it inside a `PluginGizmo`, which makes it faint
 * while the node is unselected.
 */

import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from './debugColor';

/**
 * Flat segment ends `[x0,y0,z0, x1,y1,z1, …]`.
 *
 * @canonical Gizmo lines in the collision debug colour
 */
export function CollisionDebugLines({ positions }: { positions: Float32Array }) {
  const color = useGodotLinearColor(DEFAULT_COLLISION_DEBUG_COLOR);
  return <GizmoLine positions={positions} color={color} opacity={DEFAULT_COLLISION_DEBUG_COLOR.a} />;
}
