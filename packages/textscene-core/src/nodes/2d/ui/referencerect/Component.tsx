/**
 * The native (WebGL canvas) painter for ReferenceRect: an unfilled border in
 * `border_color` at `border_width`, as `reference_rect.cpp`'s `draw_rect`.
 * `borderGeometry.ts` builds the quads.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useShowGizmos } from '../../../../r3f/contexts/ViewportModeContext';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { colorOr } from '../../../../utils/colorParser';
import { referenceRectBorderQuads } from './borderGeometry';
import type { ReferenceRectProperties } from './types';

/** `reference_rect.h:33`: `Color border_color = Color(1, 0, 0)`. */
const DEFAULT_BORDER_COLOR = { r: 1, g: 0, b: 0, a: 1 };

export function ReferenceRect({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<ReferenceRectProperties>(solveNode);
  const showGizmos = useShowGizmos();

  // One colour, so the tint multiplies in sRGB before the one linear conversion.
  const fill = useMemo(() => colorOr(props.borderColor, DEFAULT_BORDER_COLOR), [props.borderColor]);
  const filled = useMemo(() => multiplyModulate(tint.own, fill), [tint.own, fill]);
  const color = useGodotLinearColor(filled);
  const width = props.borderWidth ?? 1;
  const quads = useMemo(() => referenceRectBorderQuads(rect.w, rect.h, width), [rect.w, rect.h, width]);

  // Godot draws when `is_editor_hint() || !editor_only` (`reference_rect.cpp:38`). The editor case
  // is a gizmo for every node, so the Gizmos toggle hides it, and the toggle never hides a rect
  // that `editor_only = false` draws in the running game (ADR-0056).
  const editorOnly = props.editorOnly ?? true;
  if (editorOnly && !showGizmos) return null;

  return (
    <>
      {quads.map((q, i) => (
        <group key={i} position={[q.x, -q.y, 0]} renderOrder={renderOrder}>
          <ControlQuad width={q.w} height={q.h} color={color} opacity={filled.a} renderOrder={renderOrder} />
        </group>
      ))}
    </>
  );
}
