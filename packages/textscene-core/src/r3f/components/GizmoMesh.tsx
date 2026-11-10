/**
 * A fill gizmo: a geometry drawn as an unlit translucent `<mesh>` over the scene. A geometry with a
 * `color` attribute shades by vertex, and a four-component one carries each vertex's alpha. Inside a
 * `PluginGizmo` it wears the look of its node, from the every-node gate or `SelectedOnly` (ADR-0056).
 * The caller builds and memoises the geometry.
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
  /** Added to the gizmo render order, so a fill draws after another at a lesser value. Keep it below 1. */
  order?: number;
}

export function GizmoMesh({ geometry, color: ownColor, alpha: ownAlpha, order = 0 }: GizmoMeshProps) {
  const { color, opacity } = useGizmoLook(ownColor, ownAlpha);
  useDisposeOnRelease(geometry);
  const hasVertexColors = geometry?.hasAttribute('color') ?? false;
  const program = useMemo(
    () =>
      materialProgramInputs({
        props: {
          color,
          opacity,
          vertexColors: hasVertexColors,
          transparent: true,
          depthWrite: false,
          fog: false,
        },
        // Godot's gizmo material culls no face (`node_3d_editor_gizmos.cpp:927`), so one pass draws both.
        merge: [canvasItemFacing()],
      }),
    [color, opacity, hasVertexColors]
  );
  if (!geometry) return null;

  return (
    <GizmoGroup>
      <mesh renderOrder={GIZMO_RENDER_ORDER + order} geometry={geometry}>
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    </GizmoGroup>
  );
}
