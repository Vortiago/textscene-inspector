/**
 * `<LineEdit>` — the native (WebGL canvas) painter for `LineEdit`: the
 * `normal`/`read_only` chrome (unless `flat`), ONE clipped run of text —
 * whichever string `lineEditDisplayText` (this Control's own `_shape()` port)
 * says to paint, at whichever colour that string's state calls for, per
 * `alignment` — the active icon (`right_icon`, or the clear button in its
 * place while it is showing), and the caret while `caret_force_displayed`.
 * No selection, no IME: this is a static preview, never editing/focused, so
 * `LineEdit::_validate_caret_can_draw()`'s other branch never fires.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. `tint.own` (raw sRGB) is handed
 * to `<StyleBoxQuad>`'s `color` prop for the chrome, and multiplied into the
 * font/icon/caret colours before their own single sRGB→linear conversion —
 * `Button`'s established ordering.
 *
 * ICON. `right_icon`/the clear button inset the text from the right
 * (`nativeSolver.ts`'s own doc on `layoutLineEditContent`), so this painter's
 * `content` layout is threaded the resolved icon's width whenever one draws —
 * the shared engine's clip/pen-offset math then sees the SAME narrowed
 * width the text itself is laid out against. `right_icon` goes through
 * `useTexture2D` (`solveNode.resources`, its own scope) like
 * `texturerect/Component.tsx`'s texture, retagged `NoColorSpace` for the 2D
 * canvas the same way (`useUndecodedTexture`); the clear button's icon goes
 * through `useNodeIcon` (preferring a themed `"clear"` override over the
 * vendored default), which already applies that same tag internally. Both
 * icons' NATURAL sizes come from `solveNode.textureSlots`
 * (`nativeSolver.ts`'s `lineEditTextureSlots`), not from the loaded texture's
 * own `.image` — the solver needs that size before any texture has painted a
 * pixel, so it is declared once and read here rather than re-derived.
 *
 * CLIPPING. `Control::clip_contents` is never modelled generically in this
 * codebase (`ScrollContainer` is the one type that opts a
 * SUBTREE into it); `LineEdit` instead clips only the single run it draws
 * ITSELF, to `layoutLineEditContent`'s own `contentRect` (the rect inset by
 * the ACTIVE stylebox's margins, and the active icon's width — `ofs_max`/
 * `x_ofs`'s box in `NOTIFICATION_DRAW`, `line_edit.cpp:1392-1485`).
 * `useWorldClipPlanes` (`native/controlClipping.tsx`) does the work — local
 * planes for the rect it is given, transformed to world space through the
 * `<CanvasItemGroup ref={anchorRef}>` below and merged onto whatever this
 * node inherited, so an enclosing `ScrollContainer`'s clip is narrowed
 * further and never overridden. The icon quad itself is NOT clipped to this
 * rect (`ControlQuad` reads only the ambient clip it inherits) — Godot draws
 * it unclipped too, positioned inside the margin so it never needs to be.
 *
 * Unlike `ScrollContainer`, this painter has no descendants to re-publish the
 * merged planes to (`LineEdit` draws no children), so it only CONSUMES the
 * result for its own `<TextRun>` — no `ControlClipProvider` here.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapeText, AutowrapMode, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { useUndecodedTexture } from '../../../../r3f/undecodedTexture';
import { useTexture2D } from '../../../../resources/useTexture2D';
import type { ControlColor } from '../control/types';
import { lineEditDisplayText } from './displayText';
import { LINE_EDIT_CLEAR_ICON, LINE_EDIT_CLEAR_ICON_NATURAL_SIZE } from './icons';
import {
  lineEditTextTheme,
  layoutLineEditContent,
  lineEditCaretRect,
  lineEditRightIconSize,
  pickLineEditStyleBox,
  resolveLineEditStyleState,
  resolveLineEditTextState,
  LINE_EDIT_THEME_FONT_KEY,
  LINE_EDIT_DEFAULT_CLEAR_BUTTON_COLOR,
  LINE_EDIT_DEFAULT_CARET_COLOR,
  EXPAND_MODE_ORIGINAL_SIZE,
} from './nativeSolver';
import type { LineEditProperties } from './types';

const HORIZONTAL_ALIGNMENT_LEFT = 0;
const DEFAULT_CARET_WIDTH_PX = 1;

/** `Color(1, 1, 1, !is_editable() ? .5*.9 : .9)` — `right_icon`'s own draw-time tint (`line_edit.cpp:1443`), never used for the clear button. */
function rightIconLocalColor(editable: boolean): ControlColor {
  return { r: 1, g: 1, b: 1, a: editable ? 0.9 : 0.5 * 0.9 };
}

export function LineEdit({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<LineEditProperties>(solveNode);
  const editable = props.editable ?? true;

  const styleState = resolveLineEditStyleState(editable);
  const baseStyleBox = pickLineEditStyleBox(solveNode.styleBoxes, theme.widgets.lineEdit, styleState);

  // --- Text: which string, which theme colour, shaped -----------------------
  const { text, isPlaceholder } = lineEditDisplayText(props);
  const hasText = text.length > 0;
  const textState = resolveLineEditTextState(editable, isPlaceholder);
  const { fontSizePx, color: baseFontColor } = lineEditTextTheme(solveNode, props, textState, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // `lineSpacingPx: 0`, not the shared default of 3: `layout.heightPx` is what
  // feeds `layoutLineEditContent`'s vertical centring as Godot's
  // `shaped_text_get_size(text_rid).y`, which is the run's bare ascent+descent.
  // LineEdit sets no `line_spacing` theme constant at all — the same `0` its own
  // `lineEditMinimumSize` passes to `getLinePitchPx`. Shaping with the default
  // instead makes the height 3px too tall and lifts every field's text 1.5px
  // above where both Godot and this slice's own solver put it, past the top of
  // the content rect it is then clipped to.
  // Read INSIDE the render body, not the `useMemo` below — see Label's own
  // Component.tsx for why.
  const fontMetrics = resolveNodeFontMetrics(solveNode, LINE_EDIT_THEME_FONT_KEY);
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);
  const layout: TextLayoutResult | null = useMemo(
    () =>
      hasText
        ? shapeText(text, {
            fontSizePx,
            boxWidthPx: 0,
            autowrapMode: AutowrapMode.OFF,
            lineSpacingPx: 0,
            fontMetrics,
            preserveControl: props.drawControlChars,
          })
        : null,
    [hasText, text, fontSizePx, fontMetrics, props.drawControlChars]
  );

  // --- Icon: which one draws, its resolved size --------------------------
  const rightIconNaturalSize = solveNode.textureSlots['right_icon'] ?? null;
  const clearIconNaturalSize = solveNode.textureSlots['clear'] ?? LINE_EDIT_CLEAR_ICON_NATURAL_SIZE;
  // `display_clear_icon = !using_placeholder && is_editable() && clear_button_enabled`
  // (line_edit.cpp:1289,1444) wins over `right_icon` outright — the two are
  // never drawn together.
  const displayClearIcon = !isPlaceholder && editable && props.clearButtonEnabled === true;
  const activeIcon: 'clear' | 'right' | 'none' = displayClearIcon
    ? 'clear'
    : rightIconNaturalSize
      ? 'right'
      : 'none';
  const activeIconNaturalSize = activeIcon === 'clear' ? clearIconNaturalSize : rightIconNaturalSize;
  const iconExpandMode = props.iconExpandMode ?? EXPAND_MODE_ORIGINAL_SIZE;
  const rightIconScale = props.rightIconScale ?? 1;
  const iconSize = useMemo(
    () =>
      activeIconNaturalSize
        ? lineEditRightIconSize(activeIconNaturalSize, iconExpandMode, fontHeightPx, { x: rect.w, y: rect.h }, rightIconScale)
        : { x: 0, y: 0 },
    [activeIconNaturalSize, iconExpandMode, fontHeightPx, rect.w, rect.h, rightIconScale]
  );
  const hasIcon = activeIcon !== 'none';

  // --- Content layout: content rect (clip) + pen offset ----------------------
  const content = useMemo(
    () =>
      layoutLineEditContent({
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: baseStyleBox.contentMargin,
        alignment: props.alignment ?? HORIZONTAL_ALIGNMENT_LEFT,
        textWidthPx: layout?.widthPx ?? 0,
        textHeightPx: layout?.heightPx ?? 0,
        hasIcon,
        iconWidthPx: iconSize.x,
      }),
    [rect.w, rect.h, baseStyleBox.contentMargin, props.alignment, layout, hasIcon, iconSize.x]
  );

  // Text is clipped to the content rect, never the whole widget.
  const { anchorRef, clippingPlanes } = useWorldClipPlanes(content.contentRect);

  // Both hooks run unconditionally (fixed hook order) and each degrades to
  // "nothing to show" on its own absent input — `useNodeIcon`'s own doc.
  const { externalResources, internalResources } = solveNode.resources;
  const { texture: rightIconRawTexture } = useTexture2D(props.rightIcon, externalResources, internalResources);
  const rightIconTexture = useUndecodedTexture(rightIconRawTexture);
  const clearIconTexture = useNodeIcon(solveNode.icons['clear'], LINE_EDIT_CLEAR_ICON);
  const activeIconTexture = activeIcon === 'clear' ? clearIconTexture : activeIcon === 'right' ? rightIconTexture : null;

  const iconLocalColor: ControlColor =
    activeIcon === 'clear'
      ? (solveNode.colors['clear_button_color'] ?? LINE_EDIT_DEFAULT_CLEAR_BUTTON_COLOR)
      : rightIconLocalColor(editable);
  const tintedIconColor = useMemo(() => tintColor(iconLocalColor, tint.own), [iconLocalColor, tint.own]);
  const iconLinearColor = useMemo(() => godotColorToLinear(tintedIconColor), [tintedIconColor]);
  // Point2(width - icon.width - margin_right, height/2 - icon.height/2) (line_edit.cpp:1457) —
  // `height/2` is an INTEGER division in the source (both `int`), the rest float.
  const iconPos = { x: rect.w - iconSize.x - baseStyleBox.contentMargin.right, y: Math.trunc(rect.h / 2) - iconSize.y / 2 };

  // --- Caret: only while caret_force_displayed --------------------------
  const caretWidthPx = solveNode.constants['caret_width'] ?? DEFAULT_CARET_WIDTH_PX;
  const caretColor = solveNode.colors['caret_color'] ?? LINE_EDIT_DEFAULT_CARET_COLOR;
  const tintedCaretColor = useMemo(() => tintColor(caretColor, tint.own), [caretColor, tint.own]);
  const caretLinearColor = useMemo(() => godotColorToLinear(tintedCaretColor), [tintedCaretColor]);
  const caretRect = useMemo(
    () =>
      props.caretForceDisplayed === true
        ? lineEditCaretRect({
            rectSize: { x: rect.w, y: rect.h },
            styleMargin: baseStyleBox.contentMargin,
            alignment: props.alignment ?? HORIZONTAL_ALIGNMENT_LEFT,
            fontHeightPx,
            isPlaceholder,
            textPenX: content.textOffset.x,
            rightIconRawWidthPx: rightIconNaturalSize?.x ?? 0,
            ofsMaxPx: content.ofsMaxPx,
            caretWidthPx,
          })
        : null,
    [
      props.caretForceDisplayed,
      rect.w,
      rect.h,
      baseStyleBox.contentMargin,
      props.alignment,
      fontHeightPx,
      isPlaceholder,
      content.textOffset.x,
      content.ofsMaxPx,
      rightIconNaturalSize,
      caretWidthPx,
    ]
  );

  return (
    <CanvasItemGroup ref={anchorRef}>
      {!props.flat && <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />}
      {layout && (
        <CanvasItemGroup position={[content.textOffset.x, -content.textOffset.y, 0]}>
          <TextRun
            layout={layout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {hasIcon && activeIconTexture && iconSize.x > 0 && iconSize.y > 0 && (
        <CanvasItemGroup position={[iconPos.x, -iconPos.y, 0]}>
          <ControlQuad
            width={iconSize.x}
            height={iconSize.y}
            color={iconLinearColor}
            opacity={tintedIconColor.a}
            map={activeIconTexture}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {caretRect && (
        <CanvasItemGroup position={[caretRect.x, -caretRect.y, 0]}>
          <ControlQuad
            width={caretRect.w}
            height={caretRect.h}
            color={caretLinearColor}
            opacity={tintedCaretColor.a}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
    </CanvasItemGroup>
  );
}
