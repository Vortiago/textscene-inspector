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

/** Render order for selection-gated gizmos — above ordinary scene content. */
export const GIZMO_RENDER_ORDER = 10;

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

  return (
    <lineSegments renderOrder={GIZMO_RENDER_ORDER}>
      <primitive object={geometry} attach="geometry" />
      {/* Default to white so vertex-colored gizmos multiply against white (and we
          never hand the material an undefined color). */}
      <lineBasicMaterial
        color={color ?? 0xffffff}
        vertexColors={!!colors}
        depthWrite={false}
        transparent
      />
    </lineSegments>
  );
}
