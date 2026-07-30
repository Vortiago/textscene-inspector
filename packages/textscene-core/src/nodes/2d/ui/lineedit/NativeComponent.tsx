/**
 * `<LineEditNative>` — the native (WebGL canvas) painter for `LineEdit`: the
 * `normal`/`read_only` chrome (unless `flat`) and ONE clipped run of text —
 * whichever string `lineEditDisplayText` (this Control's own `_shape()` port)
 * says to paint, at whichever colour that string's state calls for, per
 * `alignment`. No caret, no selection, no IME: `LineEdit::_validate_caret_can_draw()`
 * gates the caret on `caret_force_displayed` or on the node both editing AND
 * holding focus, and a static preview has neither — an explicit non-goal this
 * whole slice shares with `Component.tsx` (the DOM twin).
 *
 * Tint: `ControlCanvasWalker` already folds this node's OWN `modulate` into
 * the `Modulate2DContext` value it provides AROUND this painter, so re-running
 * `modulate` here would multiply it a SECOND time. This painter therefore
 * calls `useCanvasItemTint` with `modulate: WHITE_MODULATE` (a no-op) and
 * `self_modulate` from this node's own properties, then multiplies the
 * resulting `tint.own` (raw sRGB) into the StyleBox's two colours and the
 * font colour, before each item's own single sRGB→linear conversion —
 * mirroring `Button`'s established ordering.
 *
 * CLIPPING. `Control::clip_contents` is never modelled generically in this
 * codebase (`ScrollContainer`, packet P16, is the one type that opts a
 * SUBTREE into it); `LineEdit` instead clips only the single run it draws
 * ITSELF, to `layoutLineEditContent`'s own `contentRect` (the rect inset by
 * the ACTIVE stylebox's margins — `ofs_max`/`x_ofs`'s box in
 * `NOTIFICATION_DRAW`, `line_edit.cpp:1392-1427`). `useWorldClipPlanes`
 * (`native/controlClipping.tsx`) does the work — local planes for the rect it
 * is given, transformed to world space through the `<group ref={anchorRef}>`
 * below and merged onto whatever this node inherited, so an enclosing
 * `ScrollContainer`'s clip is narrowed further and never overridden.
 *
 * Unlike `ScrollContainer`, this painter has no descendants to re-publish the
 * merged planes to (`LineEdit` draws no children), so it only CONSUMES the
 * result for its own `<TextRun>` — no `ControlClipProvider` here.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { StyleBoxQuad, tintStyleBox } from '../../../../r3f/controls/native/StyleBoxQuad';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapeText, AutowrapMode, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { lineEditDisplayText } from './displayText';
import {
  lineEditTextTheme,
  layoutLineEditContent,
  pickLineEditStyleBox,
  resolveLineEditStyleState,
  resolveLineEditTextState,
} from './nativeSolver';
import type { LineEditProperties } from './types';

const HORIZONTAL_ALIGNMENT_LEFT = 0;

export function LineEditNative({ solveNode, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = solveNode.node.properties as LineEditProperties;
  const editable = props.editable ?? true;

  const styleState = resolveLineEditStyleState(editable);
  const baseStyleBox = pickLineEditStyleBox(solveNode.styleBoxes, theme.widgets.lineEdit, styleState);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  const styleBox = useMemo(() => tintStyleBox(baseStyleBox, tint.own), [baseStyleBox, tint.own]);

  // --- Text: which string, which theme colour, shaped -----------------------
  const { text, isPlaceholder } = lineEditDisplayText(props);
  const hasText = text.length > 0;
  const textState = resolveLineEditTextState(editable, isPlaceholder);
  const { fontSizePx, color: baseFontColor } = lineEditTextTheme(props, textState, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // `lineSpacingPx: 0`, not the shared default of 3: `layout.heightPx` is what
  // feeds `layoutLineEditContent`'s vertical centring as Godot's
  // `shaped_text_get_size(text_rid).y`, which is the run's bare ascent+descent.
  // LineEdit sets no `line_spacing` theme constant at all — the same `0` its own
  // `lineEditMinimumSize` passes to `getLinePitchPx`. Shaping with the default
  // instead makes the height 3px too tall and lifts every field's text 1.5px
  // above where both Godot and this slice's own solver put it, past the top of
  // the content rect it is then clipped to.
  const layout: TextLayoutResult | null = useMemo(
    () =>
      hasText
        ? shapeText(text, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0 })
        : null,
    [hasText, text, fontSizePx]
  );

  // --- Content layout: content rect (clip) + pen offset ----------------------
  const content = useMemo(
    () =>
      layoutLineEditContent({
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: styleBox.contentMargin,
        alignment: props.alignment ?? HORIZONTAL_ALIGNMENT_LEFT,
        textWidthPx: layout?.widthPx ?? 0,
        textHeightPx: layout?.heightPx ?? 0,
        fontSizePx,
      }),
    [rect.w, rect.h, styleBox.contentMargin, props.alignment, layout, fontSizePx]
  );

  // Text is clipped to the content rect, never the whole widget.
  const { anchorRef, clippingPlanes } = useWorldClipPlanes(content.contentRect);

  return (
    <group ref={anchorRef}>
      {!props.flat && <StyleBoxQuad styleBox={styleBox} rect={rect} renderOrder={renderOrder} />}
      {layout && (
        <group position={[content.textOffset.x, -content.textOffset.y, 0]}>
          <TextRun
            layout={layout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </group>
      )}
    </group>
  );
}
