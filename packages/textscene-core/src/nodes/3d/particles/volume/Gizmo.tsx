/**
 * The editor gizmos of the GPU particles collision and attractor nodes: a box, three great circles,
 * or a box with the cell grid of the SDF type (`gpu_particles_collision_3d_gizmo_plugin.cpp:150-306`).
 * The component mounts one in an every-node `PluginGizmo`.
 */

import { useMemo } from 'react';
import { aabbEdges, centredAabb } from '../../../../godot/math/aabb';
import type { Vector3 } from '../../../../godot/math/vector';
import { gpuParticlesCollisionSdfCells } from '../../../../godot/scene/particlesCollision3d';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { cellGridLines } from '../../../../r3f/gizmo/cellGrid';
import { sphereCircleLines } from '../../../../r3f/gizmo/sphereCircles';
import { useGodotLinearColor } from '../../../../r3f/godotColor';

type VolumeKind = 'collision' | 'attractor';

/** `editors/3d_gizmos/gizmo_colors/particle_collision` and `particle_attractor` (`editor_settings.cpp:887-888`). */
const GIZMO_COLORS: Readonly<Record<VolumeKind, { r: number; g: number; b: number }>> = {
  collision: Object.freeze({ r: 0.5, g: 0.7, b: 1 }),
  attractor: Object.freeze({ r: 1, g: 0.7, b: 0.5 }),
};

/** The alpha of `shape_material_collision_internal`: the grid draws a lot of lines (`gpu_particles_collision_3d_gizmo_plugin.cpp:48-50`). */
const GRID_ALPHA = 0.15;

function VolumeLines({ lines, kind, opacity }: { lines: number[]; kind: VolumeKind; opacity?: number }) {
  const positions = useMemo(() => new Float32Array(lines), [lines]);
  return (
    <GizmoLine positions={positions} color={useGodotLinearColor(GIZMO_COLORS[kind])} opacity={opacity} />
  );
}

/** The 12 edges of the box of `size` centred on the node (`:245-262`). */
export function BoxVolumeGizmo({ size, kind }: { size: Vector3; kind: VolumeKind }) {
  const edges = useMemo(() => aabbEdges(centredAabb(size)), [size]);
  return <VolumeLines lines={edges} kind={kind} />;
}

/** The three great circles of a sphere of `radius` (`:167-243`). */
export function SphereVolumeGizmo({ radius, kind }: { radius: number; kind: VolumeKind }) {
  const circles = useMemo(() => sphereCircleLines(radius), [radius]);
  return <VolumeLines lines={circles} kind={kind} />;
}

/** The box of `size`, and the cells of `resolution` inside it at a low opacity (`:264-304`). */
export function SdfVolumeGizmo({ size, resolution }: { size: Vector3; resolution: number }) {
  const grid = useMemo(
    () => cellGridLines(centredAabb(size), gpuParticlesCollisionSdfCells(resolution)),
    [size, resolution]
  );
  return (
    <>
      <BoxVolumeGizmo size={size} kind="collision" />
      <VolumeLines lines={grid} kind="collision" opacity={GRID_ALPHA} />
    </>
  );
}
