/**
 * A selection-gated fill gizmo: a geometry drawn as an unlit translucent `<mesh>` over the scene.
 * The caller builds and memoises the geometry.
 */

import type * as THREE from 'three';
import { canvasItemFacing } from '../canvasItemFacing';
import { materialProgramInputs } from '../materialProgramInputs';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { GIZMO_RENDER_ORDER, GizmoGroup } from './GizmoGroup';

interface GizmoMeshProps {
  /** Null draws nothing. */
  geometry: THREE.BufferGeometry | null;
  color: THREE.ColorRepresentation;
  /** The opacity of the fill, from 0 to 1. */
  alpha: number;
}

export function GizmoMesh({ geometry, color, alpha }: GizmoMeshProps) {
  useDisposeOnRelease(geometry);
  if (!geometry) return null;

  // Godot's gizmo material culls no face (`node_3d_editor_gizmos.cpp:927`), so one pass draws both.
  const program = materialProgramInputs({
    props: { color, opacity: alpha, transparent: true, depthWrite: false, fog: false },
    merge: [canvasItemFacing()],
  });

  return (
    <GizmoGroup>
      <mesh renderOrder={GIZMO_RENDER_ORDER} geometry={geometry}>
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    </GizmoGroup>
  );
}
