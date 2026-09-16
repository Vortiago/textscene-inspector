/**
 * `<CheckButton>` — the native (WebGL canvas) painter for `CheckButton`: a
 * toggle-switch icon (always drawn, flush against the RIGHT content margin —
 * unlike CheckBox's LEFT-anchored check glyph) followed by the label text —
 * NO StyleBox chrome mesh at all, CheckButton's own StyleBoxes all being the
 * SAME `StyleBoxEmpty` (`nativeSolver.ts`'s own doc). Draws the vendored
 * theme icons (`themeIcons.ts`'s `CHECK_BUTTON_ICONS`).
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. The icon's own theme colour
 * (`button_checked_color`/`button_unchecked_color`, default opaque white,
 * `theme_override_colors`-able) is multiplied by it BEFORE the single
 * sRGB→linear conversion, matching Button's icon — CheckButton's own default
 * literal happens to be white too, but unlike CheckBox's painter it is not
 * hardcoded: a scene CAN override either key.
 *
 * `renderOrder` reaches both meshes (the icon `ControlQuad` and the label
 * `<TextRun>`); `clippingPlanes` reaches the text material explicitly.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapedTextSizeWidthPx, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { CHECK_BUTTON_ICONS, CHECK_BUTTON_ICON_NATURAL_SIZE } from '../../../../r3f/controls/native/themeIcons';
import {
  checkButtonCheckVOffset,
  checkButtonHSeparation,
  checkButtonIconColor,
  checkButtonIconMaxWidth,
  checkButtonMarginX,
  checkButtonMarginY,
  checkButtonTextTheme,
  fitIconSize,
  layoutCheckButtonContent,
  resolveCheckButtonDrawState,
  resolveCheckButtonIconKey,
  tintColor,
  CHECKBUTTON_DEFAULT_ALIGNMENT_LEFT,
  CHECKBUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { CheckButtonProperties } from './types';

export function CheckButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<CheckButtonProperties>(solveNode);
  const state = resolveCheckButtonDrawState(props);

  const clippingPlanes = useControlClipPlanes();

  // --- Icon: always drawn, on/off per button_pressed + disabled -----------
  const iconKey = resolveCheckButtonIconKey(props);
  const iconTexture = useIconTexture(CHECK_BUTTON_ICONS[iconKey]);
  const iconSize = useMemo(
    () => fitIconSize(CHECK_BUTTON_ICON_NATURAL_SIZE, checkButtonIconMaxWidth(solveNode.constants)),
    [solveNode.constants]
  );

  const baseIconColor = checkButtonIconColor(props, solveNode.colors);
  const tintedIconColorSrgb = useMemo(() => tintColor(baseIconColor, tint.own), [baseIconColor, tint.own]);
  const iconLinearColor = useGodotLinearColor(tintedIconColorSrgb);

  // --- Text: theme resolution + shaping ------------------------------------
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = checkButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // Read INSIDE the render body, not the `useMemo` below — see Label's own
  // Component.tsx for why.
  const fontMetrics = resolveNodeFontMetrics(solveNode, CHECKBUTTON_THEME_FONT_KEY);
  const layout: TextLayoutResult | null = useMemo(
    () => (hasText ? shapeButtonLabel(text, fontSizePx, fontMetrics) : null),
    [hasText, text, fontSizePx, fontMetrics]
  );

  // --- Content layout: icon + text placement within the solved rect -------
  const content = useMemo(
    () =>
      layoutCheckButtonContent({
        rectSize: { x: rect.w, y: rect.h },
        marginX: checkButtonMarginX({ theme }),
        marginY: checkButtonMarginY({ theme }),
        iconSize,
        checkVOffset: checkButtonCheckVOffset(solveNode.constants),
        hSeparation: checkButtonHSeparation(solveNode.constants, { theme }),
        hasText,
        textAlignment: props.alignment ?? CHECKBUTTON_DEFAULT_ALIGNMENT_LEFT,
        textNaturalSize: layout
          ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
          : { x: 0, y: 0 },
      }),
    [rect.w, rect.h, theme, iconSize, solveNode.constants, hasText, layout, props.alignment]
  );

  return (
    <>
      <CanvasItemGroup position={[content.iconRect.x, -content.iconRect.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={content.iconRect.w}
          height={content.iconRect.h}
          color={iconLinearColor}
          opacity={tintedIconColorSrgb.a}
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
