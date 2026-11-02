/**
 * A fill gizmo: a geometry drawn as an unlit translucent `<mesh>` over the scene. Inside a
 * `PluginGizmo` it wears the look of its node: a fill Godot draws for every node, whose plugin has
 * no `is_selected()` gate (the cast nodes' does not), mounts under the every-node gate, and a fill
 * Godot draws for the selected node alone (ADR-0056) sits in `SelectedOnly`. The caller builds and
 * memoises the geometry.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { canvasItemFacing } from '../canvasItemFacing';
import { materialProgramInputs } from '../materialProgramInputs';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { useGizmoLook } from '../gizmo/useGizmoLook';
import { GIZMO_RENDER_ORDER, GizmoGroup } from './GizmoGroup';

interface GizmoMeshProps {
  /** Null draws nothing. */
  geometry: THREE.BufferGeometry | null;
  color: THREE.ColorRepresentation;
  /** The opacity of the fill, from 0 to 1. */
  alpha: number;
}

export function GizmoMesh({ geometry, color: ownColor, alpha: ownAlpha }: GizmoMeshProps) {
  const { color, opacity } = useGizmoLook(ownColor, ownAlpha);
  useDisposeOnRelease(geometry);
  // Godot's gizmo material culls no face (`node_3d_editor_gizmos.cpp:927`), so one pass draws both.
  const program = useMemo(
    () =>
      materialProgramInputs({
        props: { color, opacity, transparent: true, depthWrite: false, fog: false },
        merge: [canvasItemFacing()],
      }),
    [color, opacity]
  );
  if (!geometry) return null;

  return (
    <GizmoGroup>
      <mesh renderOrder={GIZMO_RENDER_ORDER} geometry={geometry}>
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    </GizmoGroup>
  );
}
