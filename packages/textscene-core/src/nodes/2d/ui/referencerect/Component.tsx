/**
 * `<ReferenceRect>` — the native (WebGL canvas) painter for ReferenceRect: an
 * unfilled border outline in `border_color` at `border_width`
 * (`reference_rect.cpp`'s `NOTIFICATION_DRAW` → `CanvasItem::draw_rect`; see
 * `borderGeometry.ts` for the exact quads).
 *
 * `editor_only` is NOT inert here. `_notification` draws when
 * `Engine::is_editor_hint() || !editor_only` (`reference_rect.cpp:38`):
 *  - `editor_only === false` is RUNTIME content — a real running game (and
 *    `pnpm ref:godot`'s own reference render, where `is_editor_hint()` is
 *    false) shows the border unconditionally, so this painter does too.
 *  - `editor_only === true` (the default) only ever shows inside the EDITOR,
 *    which this previewer emulates. Godot's own editor draws every
 *    ReferenceRect in the open scene at once with no selection check, but
 *    ADR-0018 deliberately diverges from that for Marker2D/Path2D to avoid
 *    exactly that clutter, and the same divergence applies here: visible
 *    only while this node is the current `SelectionContext.
 *    selectedNodePath`. `useGizmoVisible()` itself is not usable — it reads
 *    `NodePathContext`, which `ControlCanvasWalker` never publishes — so
 *    this reads `solveNode.path` against `useOptionalSelection()` directly,
 *    the same path space `buildSolveTree.ts` already keys `SolveNode.hidden`
 *    against.
 *
 * Tint: the walker's `tint` prop, multiplied into `border_color` in sRGB
 * before the single sRGB→linear conversion — the ColorRect one-colour
 * shortcut, valid here because a border stroke carries only one colour.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useOptionalSelection } from '../../../../r3f/contexts/SelectionContext';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { colorOr } from '../../../../utils/colorParser';
import { referenceRectBorderQuads } from './borderGeometry';
import type { ReferenceRectProperties } from './types';

/** `reference_rect.h:33` — `Color border_color = Color(1, 0, 0)`. */
const DEFAULT_BORDER_COLOR = { r: 1, g: 0, b: 0, a: 1 };

export function ReferenceRect({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<ReferenceRectProperties>(solveNode);
  const selection = useOptionalSelection();

  const fill = useMemo(() => colorOr(props.borderColor, DEFAULT_BORDER_COLOR), [props.borderColor]);
  const filled = useMemo(() => multiplyModulate(tint.own, fill), [tint.own, fill]);
  const color = useGodotLinearColor(filled);
  const width = props.borderWidth ?? 1;
  const quads = useMemo(
    () => referenceRectBorderQuads(rect.w, rect.h, width),
    [rect.w, rect.h, width]
  );

  const editorOnly = props.editorOnly ?? true;
  const visible = !editorOnly || selection?.selectedNodePath === solveNode.path;
  if (!visible) return null;

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
