/**
 * `<LineEdit>`, the native painter: `normal` or `read_only` chrome unless `flat`, one clipped run of the
 * text `lineEditDisplayText` picks in its state's colour, the active icon, and the caret while
 * `caret_force_displayed`, since a static preview never focuses and `_validate_caret_can_draw()`'s other
 * branch never fires. It draws no selection or IME. `ControlCanvasWalker` owns `visible`, `children` and the transform.
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

/** `Color(1, 1, 1, !is_editable() ? .5*.9 : .9)`: `right_icon`'s draw-time tint (`line_edit.cpp:1443`), never the clear button's. */
function rightIconLocalColor(editable: boolean): ControlColor {
  return { r: 1, g: 1, b: 1, a: editable ? 0.9 : 0.5 * 0.9 };
}

export function LineEdit({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<LineEditProperties>(solveNode);
  const editable = props.editable ?? true;

  const styleState = resolveLineEditStyleState(editable);
  const baseStyleBox = pickLineEditStyleBox(solveNode.styleBoxes, theme.widgets.lineEdit, styleState);

  // Text: which string, which theme colour, shaped
  const { text, isPlaceholder } = lineEditDisplayText(props);
  const hasText = text.length > 0;
  const textState = resolveLineEditTextState(editable, isPlaceholder);
  const { fontSizePx, color: baseFontColor } = lineEditTextTheme(solveNode, props, textState, { theme });
  // `tint.own` is `self_modulate` folded onto the inherited `modulate`, raw sRGB. The chrome takes it as
  // `<StyleBoxQuad>`'s `color`, and each font, icon and caret colour multiplies it before its one
  // sRGB-to-linear conversion, as `Button` does.
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // `lineSpacingPx: 0`, not the shared 3: `layout.heightPx` stands in for `shaped_text_get_size(text_rid).y`,
  // bare ascent plus descent, in the vertical centring. LineEdit sets no `line_spacing` (`lineEditMinimumSize`),
  // and a spacing of 3 lifts the text 1.5px, past the top of its clip rect. Read in the render body, not
  // the `useMemo` below, for the reason Label's Component.tsx gives.
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

  // Icon: which one draws, its resolved size
  // Natural sizes come from `solveNode.textureSlots` (`lineEditTextureSlots`), not the loaded texture's
  // `.image`: the solver needs them before any texture loads. The content layout takes the icon width,
  // so the clip and pen offset see the width the text is laid out against.
  const rightIconNaturalSize = solveNode.textureSlots['right_icon'] ?? null;
  const clearIconNaturalSize = solveNode.textureSlots['clear'] ?? LINE_EDIT_CLEAR_ICON_NATURAL_SIZE;
  // `display_clear_icon = !using_placeholder && is_editable() && clear_button_enabled`
  // (line_edit.cpp:1289,1444) replaces `right_icon`: the two never draw together.
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

  // Content layout: the clip rect and the pen offset
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
        rtl: solveNode.rtl,
      }),
    [rect.w, rect.h, baseStyleBox.contentMargin, props.alignment, layout, hasIcon, iconSize.x, solveNode.rtl]
  );

  // Only this run clips, to `contentRect` (`ofs_max`/`x_ofs`'s box, `line_edit.cpp:1392-1485`), since
  // `clip_contents` is not modelled generically. The planes merge onto the inherited clip, so an enclosing
  // ScrollContainer only narrows, and with no children no `ControlClipProvider` is needed. The icon stays
  // unclipped, as Godot draws it inside the margin.
  const { anchorRef, clippingPlanes } = useWorldClipPlanes(content.contentRect);

  // Both hooks run in a fixed order and each shows nothing on an absent input (`useNodeIcon`).
  // `right_icon` loads in its own scope and is retagged `NoColorSpace` for the 2D canvas
  // (`useUndecodedTexture`). `useNodeIcon` prefers a themed `"clear"` and applies the same tag.
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
  // Point2(width - icon.width - margin_right, height/2 - icon.height/2) (line_edit.cpp:1457), where
  // `height/2` is an integer division. RTL puts the x at the left margin (line_edit.cpp:1458-1460).
  const iconPos = {
    x: solveNode.rtl ? baseStyleBox.contentMargin.left : rect.w - iconSize.x - baseStyleBox.contentMargin.right,
    y: Math.trunc(rect.h / 2) - iconSize.y / 2,
  };

  // Caret: only while caret_force_displayed
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
            rtl: solveNode.rtl,
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
      solveNode.rtl,
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
