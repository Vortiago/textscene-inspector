/**
 * The editor marker of a 2D joint: its strokes as filled quads in the two colours Godot draws them
 * in, for every node while the Gizmos toggle is on (ADR-0056). Godot's 2D joints draw it in the
 * editor and with collision debugging on (`pin_joint_2d.cpp:42`).
 */

import { useMemo } from 'react';
import { GizmoMesh } from '../../../../r3f/components/GizmoMesh';
import { useGizmoDrawn } from '../../../../r3f/hooks/useGizmoState';
import { thickLinesGeometry } from '../../../../r3f/gizmo/thickLines';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import type { JointStroke, JointStrokeStyle } from './jointStrokes';

/** Width in pixels, colour and alpha of each stroke style (`groove_joint_2d.cpp:46-49`). */
const STROKE_LOOKS: Record<
  JointStrokeStyle,
  { width: number; color: { r: number; g: number; b: number }; alpha: number }
> = {
  frame: { width: 3, color: { r: 0.7, g: 0.6, b: 0 }, alpha: 0.5 },
  offset: { width: 5, color: { r: 0.8, g: 0.8, b: 0.9 }, alpha: 0.5 },
};

/** Drawn in this order: the offset bar sits on top of the frame, as Godot draws it last. */
const STYLES: JointStrokeStyle[] = ['frame', 'offset'];

export function JointMarker({ strokes }: { strokes: readonly JointStroke[] }) {
  const isDrawn = useGizmoDrawn('every-node');
  const geometries = useMemo(
    () =>
      STYLES.map((style) =>
        thickLinesGeometry(
          strokes.filter((stroke) => stroke.style === style),
          STROKE_LOOKS[style].width
        )
      ),
    [strokes]
  );
  if (!isDrawn) return null;
  return (
    <>
      {STYLES.map((style, index) => (
        <GizmoMesh
          key={style}
          geometry={geometries[index]!}
          color={godotColorToLinear(STROKE_LOOKS[style].color)}
          alpha={STROKE_LOOKS[style].alpha}
        />
      ))}
    </>
  );
}
