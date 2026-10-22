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

/** Whether the segment starting at `start` has an `inf` or `nan` vertex. */
function hasNonFiniteVertex(positions: Float32Array, start: number): boolean {
  for (let i = start; i < start + FLOATS_PER_SEGMENT; i++) {
    if (!Number.isFinite(positions[i])) return true;
  }
  return false;
}

/** The segments that have no `inf` or `nan` vertex. The same arrays when every segment has none. */
function finiteSegments(positions: Float32Array, colors: Float32Array | undefined) {
  const segmentCount = Math.floor(positions.length / FLOATS_PER_SEGMENT);
  const keptStarts: number[] = [];
  for (let segment = 0; segment < segmentCount; segment++) {
    const start = segment * FLOATS_PER_SEGMENT;
    if (!hasNonFiniteVertex(positions, start)) keptStarts.push(start);
  }
  if (keptStarts.length === segmentCount) return { positions, colors };
  const onlyKept = (array: Float32Array) => {
    const kept = new Float32Array(keptStarts.length * FLOATS_PER_SEGMENT);
    keptStarts.forEach((start, index) =>
      kept.set(array.subarray(start, start + FLOATS_PER_SEGMENT), index * FLOATS_PER_SEGMENT)
    );
    return kept;
  };
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
