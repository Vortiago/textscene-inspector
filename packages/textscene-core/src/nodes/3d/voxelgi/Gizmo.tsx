/**
 * The editor gizmo of a VoxelGI: the 12 edges of its box, and the grid of its cells at a low opacity
 * (`voxel_gi_gizmo_plugin.cpp:96-164`). The component gates it with `useGizmoState`.
 */

import { useMemo } from 'react';
import { centredAabb } from '../../../godot/math/aabb';
import { voxelGiCells } from '../../../godot/scene/voxelGi';
import { AabbGizmo } from '../../../r3f/components/AabbGizmo';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { cellGridLines } from '../../../r3f/gizmo/cellGrid';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import type { VoxelGIProperties } from './types';

/** `editors/3d_gizmos/gizmo_colors/voxel_gi` (`editor_settings.cpp:896`). */
const GIZMO_COLOR = Object.freeze({ r: 0.5, g: 1, b: 0.6 });

/** The alpha of `voxel_gi_internal_material`: the grid draws a lot of lines (`voxel_gi_gizmo_plugin.cpp:47-48`). */
const GRID_ALPHA = 0.02;

export function VoxelGIGizmo({ voxelGi }: { voxelGi: VoxelGIProperties }) {
  const { size, subdiv } = voxelGi;
  const box = useMemo(() => centredAabb(size), [size]);
  const grid = useMemo(() => new Float32Array(cellGridLines(box, voxelGiCells(subdiv))), [box, subdiv]);
  return (
    <>
      <AabbGizmo aabb={box} color={GIZMO_COLOR} variant="selected" />
      <GizmoLine positions={grid} color={useGodotLinearColor(GIZMO_COLOR)} opacity={GRID_ALPHA} />
    </>
  );
}
