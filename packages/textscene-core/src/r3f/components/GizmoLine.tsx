/**
 * The render ritual of a selection-gated line gizmo: a BufferGeometry from flat
 * `positions` and optional `colors`, disposed on rebuild since R3F does not dispose
 * an attached geometry, drawn as an unlit transparent `<lineSegments>` over the scene.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { editorHelperUserData } from '../editorHelpers';
import { materialProgramInputs } from '../materialProgramInputs';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { GIZMO_GROUP_ORDER, GIZMO_RENDER_ORDER } from './gizmoRenderOrder';

interface GizmoLineProps {
  /** Flat line-segment vertex positions `[x0,y0,z0, x1,y1,z1, …]`. */
  positions: Float32Array;
  /** Optional flat per-vertex RGB colors; when set, the material uses them. */
  colors?: Float32Array;
  /** Solid line color (ignored when `colors` is set; defaults to white). */
  color?: THREE.ColorRepresentation;
}

const FLOATS_PER_SEGMENT = 6;

/** The segments that have no `inf` or `nan` vertex. The same arrays when every segment has none. */
function finiteSegments(positions: Float32Array, colors: Float32Array | undefined) {
  const segmentCount = Math.floor(positions.length / FLOATS_PER_SEGMENT);
  const isFiniteSegment = (segment: number): boolean =>
    positions
      .subarray(segment * FLOATS_PER_SEGMENT, (segment + 1) * FLOATS_PER_SEGMENT)
      .every(Number.isFinite);
  const kept = Array.from({ length: segmentCount }, (_, segment) => segment).filter(isFiniteSegment);
  if (kept.length === segmentCount) return { positions, colors };
  const onlyKept = (array: Float32Array) =>
    Float32Array.from(
      kept.flatMap((segment) =>
        Array.from(array.subarray(segment * FLOATS_PER_SEGMENT, (segment + 1) * FLOATS_PER_SEGMENT))
      )
    );
  return { positions: onlyKept(positions), colors: colors && onlyKept(colors) };
}

/**
 * Draws each segment that has no `inf` or `nan` vertex. Godot draws no pixel for a line with
 * one, and its finite neighbours still draw. three.js warns about a NaN bounding sphere.
 */
export function GizmoLine({ positions: allPositions, colors: allColors, color }: GizmoLineProps) {
  const { positions, colors } = useMemo(
    () => finiteSegments(allPositions, allColors),
    [allPositions, allColors]
  );
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);
  useDisposeOnRelease(geometry);
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

  if (positions.length === 0) return null;

  return (
    <group renderOrder={GIZMO_GROUP_ORDER} userData={helperUserData}>
      <lineSegments renderOrder={GIZMO_RENDER_ORDER}>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial key={program.key} {...program.props} />
      </lineSegments>
    </group>
  );
}
