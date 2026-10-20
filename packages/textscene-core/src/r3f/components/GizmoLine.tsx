/**
 * The render ritual of a selection-gated line gizmo: a BufferGeometry from flat
 * `positions` and optional `colors`, disposed on rebuild since R3F does not dispose
 * an attached geometry, drawn as an unlit transparent `<lineSegments>` over the scene.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { editorHelperUserData } from '../editorHelpers';
import { materialProgramInputs } from '../materialProgramInputs';

/** Render order for selection-gated gizmos, above ordinary scene content. */
const GIZMO_RENDER_ORDER = 10;

/**
 * The group order a gizmo draws at, above every canvas item. A gizmo is editor
 * chrome, not a CanvasItem, and three compares the nearest group's order first,
 * so at its node's canvas key it would fall behind anything authored after it.
 */
const GIZMO_GROUP_ORDER = Number.MAX_SAFE_INTEGER;

interface GizmoLineProps {
  /** Flat line-segment vertex positions `[x0,y0,z0, x1,y1,z1, …]`. */
  positions: Float32Array;
  /** Optional flat per-vertex RGB colors; when set, the material uses them. */
  colors?: Float32Array;
  /** Solid line color (ignored when `colors` is set; defaults to white). */
  color?: THREE.ColorRepresentation;
}

/**
 * Draws nothing when a vertex is `inf` or `nan`: Godot draws no pixel for such a line, and
 * three.js warns about a NaN bounding sphere.
 */
export function GizmoLine({ positions, colors, color }: GizmoLineProps) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Memoised, as R3F assigns a new `userData` object on each render.
  const helperUserData = useMemo(editorHelperUserData, []);

  // `vertexColors` is a program input (`WebGLPrograms.js:308`), and a gizmo that
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

  if (!positions.every(Number.isFinite)) return null;

  return (
    <group renderOrder={GIZMO_GROUP_ORDER} userData={helperUserData}>
      <lineSegments renderOrder={GIZMO_RENDER_ORDER}>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial key={program.key} {...program.props} />
      </lineSegments>
    </group>
  );
}
