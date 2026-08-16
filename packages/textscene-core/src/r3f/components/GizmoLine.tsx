/**
 * <GizmoLine> — the shared render ritual for selection-gated editor line gizmos
 * (the 2D/3D marker crosses, path-curve polylines, and path-follow handles).
 *
 * It owns the bits every line gizmo repeated: build a BufferGeometry from a flat
 * `positions` array (plus optional per-vertex `colors`), dispose it on rebuild
 * (R3F won't auto-dispose a geometry passed via `attach`), and draw it as an
 * unlit, depth-write-free, transparent `<lineSegments>` on a high render order so
 * it sits over scene content. Callers just compute the vertex arrays.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { materialProgramInputs } from '../materialProgramInputs';

/** Render order for selection-gated gizmos — above ordinary scene content. */
export const GIZMO_RENDER_ORDER = 10;

/**
 * The GROUP order a gizmo draws at — above every canvas item there can be.
 *
 * A gizmo is editor chrome, not a CanvasItem, so it does not take a place in
 * the canvas the way `canvasPaintOrder.ts` assigns one. It also cannot rely on
 * `renderOrder` alone to stay on top: three compares the nearest enclosing
 * group's order FIRST, and in the 2D canvas that group is the gizmo's own node,
 * sitting at whatever position the scene gave it — so a gizmo would fall behind
 * anything authored after its node. Lifting the group clear of the key space
 * keeps "over scene content" true, which is the whole point of a selection
 * affordance.
 */
export const GIZMO_GROUP_ORDER = Number.MAX_SAFE_INTEGER;

export interface GizmoLineProps {
  /** Flat line-segment vertex positions `[x0,y0,z0, x1,y1,z1, …]`. */
  positions: Float32Array;
  /** Optional flat per-vertex RGB colors; when set, the material uses them. */
  colors?: Float32Array;
  /** Solid line color (ignored when `colors` is set; defaults to white). */
  color?: THREE.ColorRepresentation;
}

export function GizmoLine({ positions, colors, color }: GizmoLineProps) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // `vertexColors` IS a program input (`WebGLPrograms.js:308`), and a gizmo that
  // gains or loses its colour attribute would otherwise keep the first program.
  // Default to white so vertex-coloured gizmos multiply against white (and we
  // never hand the material an undefined colour).
  const program = materialProgramInputs({
    props: {
      color: color ?? 0xffffff,
      vertexColors: !!colors,
      depthWrite: false,
      transparent: true,
    },
  });

  return (
    <group renderOrder={GIZMO_GROUP_ORDER}>
      <lineSegments renderOrder={GIZMO_RENDER_ORDER}>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial key={program.key} {...program.props} />
      </lineSegments>
    </group>
  );
}
