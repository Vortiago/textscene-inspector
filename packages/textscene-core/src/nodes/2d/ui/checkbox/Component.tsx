/**
 * `<CheckBox>` — the native (WebGL canvas) painter for `CheckBox`: a
 * check/radio indicator icon (always drawn, `check_box.cpp::_notification`'s
 * `NOTIFICATION_DRAW` has no visibility gate) followed by the label text —
 * NO StyleBox chrome mesh at all, since CheckBox's own "normal" StyleBox is a
 * `StyleBoxEmpty` (`nativeSolver.ts`'s own doc). This painter draws the
 * vendored theme icons (`native/themeIcons.ts`'s `CHECK_BOX_ICONS`).
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. The icon's own theme colour is
 * ALWAYS opaque white (`checkbox_checked_color`/
 * `checkbox_unchecked_color` both `Color(1,1,1)`, `default_theme.cpp:312-313`)
 * — the disabled dimming is baked into the disabled SVGs' own fill-opacity,
 * not a separate runtime multiply — so the icon quad's colour/opacity are
 * `tint.color`/`tint.opacity` directly, with no extra per-state multiply the
 * way `Button`'s icon needs one.
 *
 * `renderOrder` reaches both meshes this painter emits (the icon `ControlQuad`
 * and the label `<TextRun>`); `clippingPlanes` reaches the text material
 * explicitly (the icon quad reads `useControlClipPlanes()` internally).
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { CHECK_BOX_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  checkBoxIconMaxWidth,
  checkBoxHSeparation,
  checkBoxCheckVOffset,
  checkBoxIconNaturalSize,
  checkBoxTextTheme,
  fitIconSize,
  layoutCheckBoxContent,
  resolveCheckBoxDrawState,
  resolveCheckBoxIconKey,
  tintColor,
  CHECK_BOX_ICON_THEME_NAME,
  CHECKBOX_THEME_FONT_KEY,
} from './nativeSolver';
import type { CheckBoxProperties } from './types';

export function CheckBox({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<CheckBoxProperties>(solveNode);
  const state = resolveCheckBoxDrawState(props);

  const clippingPlanes = useControlClipPlanes();

  // --- Icon: always drawn, checked/unchecked (or radio_*) per state --------
  const iconKey = resolveCheckBoxIconKey(props);
  const iconTexture = useNodeIcon(solveNode.icons[CHECK_BOX_ICON_THEME_NAME[iconKey]], CHECK_BOX_ICONS[iconKey]);
  const iconSize = useMemo(() => {
    const fitted = fitIconSize(checkBoxIconNaturalSize(solveNode), checkBoxIconMaxWidth(solveNode.constants));
    return { x: Math.round(fitted.x), y: Math.round(fitted.y) };
  }, [solveNode]);

  // --- Text: theme resolution + shaping ------------------------------------
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = checkBoxTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // Read INSIDE the render body, not the `useMemo` below — see Label's own
  // Component.tsx for why.
  const fontMetrics = resolveNodeFontMetrics(solveNode, CHECKBOX_THEME_FONT_KEY);
  const layout: TextLayoutResult | null = useMemo(
    () =>
      hasText
        ? shapeButtonLabel(text, fontSizePx, fontMetrics)
        : null,
    [hasText, text, fontSizePx, fontMetrics]
  );

  // --- Content layout: icon + text placement within the solved rect -------
  const content = useMemo(
    () =>
      layoutCheckBoxContent({
        rectSize: { x: rect.w, y: rect.h },
        margin: theme.contentMargin,
        iconSize,
        checkVOffset: checkBoxCheckVOffset(solveNode.constants),
        hSeparation: checkBoxHSeparation(solveNode.constants, { theme }),
        hasText,
        rtl: solveNode.rtl,
        // Godot's draw path reads the same ceiled `text_buf->get_size()` its
        // minimum size does (`scene/gui/button.cpp:343,349`), so the alignment
        // shift is computed against the ceiled width, not the raw pen advance.
        // Only the width needs it: `Size2::ceil()` ceils both components, but
        // the line pitch is already a sum of independently-ceiled ascent and
        // descent plus an integral theme spacing, so the height is integral.
        textNaturalSize: layout
          ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
          : { x: 0, y: 0 },
      }),
    [rect.w, rect.h, theme, iconSize, solveNode.constants, hasText, layout, solveNode.rtl]
  );

  return (
    <>
      <CanvasItemGroup position={[content.iconRect.x, -content.iconRect.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={content.iconRect.w}
          height={content.iconRect.h}
          color={tint.color}
          opacity={tint.opacity}
          map={iconTexture}
        />
      </CanvasItemGroup>
      {content.textOffset && layout && (
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
    </>
  );
}
