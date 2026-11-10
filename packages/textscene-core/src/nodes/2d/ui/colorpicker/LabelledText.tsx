/**
 * One row of shaped picker text, placed inside its box.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';

interface LabelledTextProps {
  rect: Rect2;
  layout: TextLayoutResult | null;
  fontSizePx: number;
  tint: Rgba;
  clippingPlanes: THREE.Plane[];
  renderOrder: number;
  /** Right-aligns within `rect`, as the SpinBox's `LineEdit` does for a number (`line_edit.cpp`). A plain `Label` aligns left. */
  alignRight?: boolean;
  /** The `x_ofs` floor of `LineEdit::_notification(NOTIFICATION_DRAW)`: the gap between the text and its aligned edge. 0 for a Label or Button, which has no box under the text. */
  inset?: number;
  /** `Control::is_layout_rtl()`: swaps the leading and trailing arms and leaves centre alone, as `label.cpp:497-509`, `line_edit.cpp:1397-1421` and `button.cpp:262-276` do. */
  rtl?: boolean;
}

/** One row of shaped text, vertically centred in `rect`. */
export function LabelledText({
  rect,
  layout,
  fontSizePx,
  tint,
  clippingPlanes,
  renderOrder,
  alignRight,
  inset = 0,
  rtl = false,
}: LabelledTextProps) {
  if (!layout) return null;
  const width = shapedTextSizeWidthPx(layout.widthPx);
  const trailing = Math.max(inset, rect.w - width - inset);
  const x = (alignRight ?? false) !== rtl ? trailing : inset;
  const y = Math.max(0, (rect.h - layout.heightPx) / 2);
  return (
    <CanvasItemGroup position={[rect.x + x, -(rect.y + y), 0]}>
      <TextRun
        layout={layout}
        fontSizePx={fontSizePx}
        tint={tint}
        clippingPlanes={clippingPlanes}
        renderOrder={renderOrder}
      />
    </CanvasItemGroup>
  );
}
