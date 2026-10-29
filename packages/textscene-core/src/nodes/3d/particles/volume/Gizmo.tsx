/**
 * The editor gizmos of the GPU particles collision and attractor nodes: a box, three great circles,
 * or a box with the cell grid of the SDF type (`gpu_particles_collision_3d_gizmo_plugin.cpp:150-306`).
 */

import { useMemo } from 'react';
import { centredAabb } from '../../../../godot/math/aabb';
import type { Vector3 } from '../../../../godot/math/vector';
import { gpuParticlesCollisionSdfCells } from '../../../../godot/scene/particlesCollision3d';
import { AabbGizmo } from '../../../../r3f/components/AabbGizmo';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { cellGridLines } from '../../../../r3f/gizmo/cellGrid';
import { sphereCircleLines } from '../../../../r3f/gizmo/sphereCircles';
import { useGodotLinearColor } from '../../../../r3f/godotColor';

type Colour = { r: number; g: number; b: number };

/** `editors/3d_gizmos/gizmo_colors/particle_collision` and `particle_attractor` (`editor_settings.cpp:887-888`). */
export const COLLISION_COLOR: Colour = Object.freeze({ r: 0.5, g: 0.7, b: 1 });
export const ATTRACTOR_COLOR: Colour = Object.freeze({ r: 1, g: 0.7, b: 0.5 });

/** The alpha of `shape_material_collision_internal`: the grid draws a lot of lines (`:48-50`). */
const GRID_ALPHA = 0.15;

/** The box centred on the node. The memo keys on the numbers, as a re-parse gives a new object. */
function useCentredBox({ x, y, z }: Vector3) {
  return useMemo(() => centredAabb({ x, y, z }), [x, y, z]);
}

export function BoxVolumeGizmo({ size, color }: { size: Vector3; color: Colour }) {
  return <AabbGizmo aabb={useCentredBox(size)} color={color} />;
}

export function SphereVolumeGizmo({ radius, color }: { radius: number; color: Colour }) {
  const circles = useMemo(() => new Float32Array(sphereCircleLines(radius)), [radius]);
  return <GizmoLine positions={circles} color={useGodotLinearColor(color)} />;
}

/** The box of `size`, and the cells of `resolution` inside it at a low opacity. */
export function SdfVolumeGizmo({ size, resolution }: { size: Vector3; resolution: number }) {
  const box = useCentredBox(size);
  const grid = useMemo(
    () => new Float32Array(cellGridLines(box, gpuParticlesCollisionSdfCells(resolution))),
    [box, resolution]
  );
  return (
    <>
      <AabbGizmo aabb={box} color={COLLISION_COLOR} />
      <GizmoLine positions={grid} color={useGodotLinearColor(COLLISION_COLOR)} opacity={GRID_ALPHA} />
    </>
  );
}
