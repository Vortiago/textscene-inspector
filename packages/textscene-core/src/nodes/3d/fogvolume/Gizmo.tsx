/**
 * The editor gizmo of a FogVolume: the 12 edges of its box, for every shape but WORLD, which has no
 * box (`fog_volume_gizmo_plugin.cpp:92-125`). The component gates it with `useGizmoVisible`.
 */

import { useMemo } from 'react';
import { centredAabb } from '../../../godot/math/aabb';
import type { Vector3 } from '../../../godot/math/vector';
import { FogVolumeShape } from '../../../godot/rendering/environment/fogVolume';
import { AabbGizmo } from '../../../r3f/components/AabbGizmo';

/** `editors/3d_gizmos/gizmo_colors/fog_volume` (`editor_settings.cpp:885`). */
const GIZMO_COLOR = Object.freeze({ r: 0.5, g: 0.7, b: 1 });

export function FogVolumeGizmo({ size, shape }: { size: Vector3; shape: FogVolumeShape | number }) {
  const box = useMemo(() => centredAabb(size), [size]);
  if (shape === FogVolumeShape.WORLD) return null;
  return <AabbGizmo aabb={box} color={GIZMO_COLOR} />;
}
