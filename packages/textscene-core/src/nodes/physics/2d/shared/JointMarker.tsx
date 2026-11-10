/**
 * The editor marker of a 2D joint: its strokes as filled quads in the two looks Godot draws them in,
 * for every node while the Gizmos toggle is on (ADR-0056). Godot's 2D joints draw it in the editor
 * and with collision debugging on (`pin_joint_2d.cpp:42`).
 */

import { useMemo } from 'react';
import { GizmoMesh } from '../../../../r3f/components/GizmoMesh';
import { useGizmoDrawn } from '../../../../r3f/hooks/useGizmoState';
import { thickLinesGeometry } from '../../../../r3f/gizmo/thickLines';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import type { JointStroke, JointStrokeStyle } from './jointStrokes';

/**
 * Width in pixels, colour and alpha of each stroke style (`groove_joint_2d.cpp:46-49`). The
 * offset bar comes last, as Godot draws it last, so it sits on top of the frame.
 */
const STROKE_LOOKS: Record<
  JointStrokeStyle,
  { width: number; color: { r: number; g: number; b: number }; alpha: number }
> = {
  frame: { width: 3, color: { r: 0.7, g: 0.6, b: 0 }, alpha: 0.5 },
  offset: { width: 5, color: { r: 0.8, g: 0.8, b: 0.9 }, alpha: 0.5 },
};

export function JointMarker({ strokes }: { strokes: readonly JointStroke[] }) {
  // The gate sits above the geometry, so a hidden marker builds no vertices.
  return useGizmoDrawn('every-node') ? <StrokeLayers strokes={strokes} /> : null;
}

function StrokeLayers({ strokes }: { strokes: readonly JointStroke[] }) {
  const layers = useMemo(
    () =>
      (Object.keys(STROKE_LOOKS) as JointStrokeStyle[]).flatMap((style) => {
        const geometry = thickLinesGeometry(
          strokes.filter((stroke) => stroke.style === style),
          STROKE_LOOKS[style].width
        );
        return geometry ? [{ style, geometry }] : [];
      }),
    [strokes]
  );
  return layers.map(({ style, geometry }) => (
    <GizmoMesh
      key={style}
      geometry={geometry}
      color={godotColorToLinear(STROKE_LOOKS[style].color)}
      alpha={STROKE_LOOKS[style].alpha}
    />
  ));
}
