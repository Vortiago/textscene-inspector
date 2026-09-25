/**
 * `<CheckButton>`, the native (WebGL canvas) painter: a toggle-switch icon, always drawn, at the
 * content margin on the side opposite CheckBox's glyph, beside the label. No chrome: every
 * StyleBox is the same `StyleBoxEmpty`. `ControlCanvasWalker` owns `visible`, the children and
 * the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapedTextSizeWidthPx, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { CHECK_BUTTON_ICONS } from '../../../../r3f/controls/native/themeIcons';
import {
  checkButtonCheckVOffset,
  checkButtonHSeparation,
  checkButtonIconColor,
  checkButtonIconMaxWidth,
  checkButtonIconNaturalSize,
  checkButtonMarginX,
  checkButtonMarginY,
  checkButtonTextTheme,
  fitIconSize,
  layoutCheckButtonContent,
  resolveCheckButtonDrawState,
  resolveCheckButtonIconKey,
  tintColor,
  CHECK_BUTTON_ICON_THEME_NAME,
  CHECKBUTTON_DEFAULT_ALIGNMENT_LEFT,
  CHECKBUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { CheckButtonProperties } from './types';

export function CheckButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<CheckButtonProperties>(solveNode);
  const state = resolveCheckButtonDrawState(props);

  // `renderOrder` reaches both meshes. `<TextRun>` builds its own material, so it takes
  // the clip planes explicitly, while the icon quad reads them itself.
  const clippingPlanes = useControlClipPlanes();

  const iconKey = resolveCheckButtonIconKey(props, solveNode.rtl);
  const iconTexture = useNodeIcon(solveNode.icons[CHECK_BUTTON_ICON_THEME_NAME[iconKey]], CHECK_BUTTON_ICONS[iconKey]);
  const iconSize = useMemo(
    () =>
      fitIconSize(
        checkButtonIconNaturalSize(solveNode, props.disabled === true, solveNode.rtl),
        checkButtonIconMaxWidth(solveNode.constants)
      ),
    [solveNode, props.disabled]
  );

  // Unlike CheckBox's fixed white, the icon colour is a theme key a scene can override, so it
  // takes the tint before its one sRGB-to-linear conversion, as Button's icon does.
  const baseIconColor = checkButtonIconColor(props, solveNode.colors);
  const tintedIconColorSrgb = useMemo(() => tintColor(baseIconColor, tint.own), [baseIconColor, tint.own]);
  const iconLinearColor = useGodotLinearColor(tintedIconColorSrgb);

  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = checkButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // Read inside the render body, not the `useMemo` below: Label's Component.tsx
  // gives the reason.
  const fontMetrics = resolveNodeFontMetrics(solveNode, CHECKBUTTON_THEME_FONT_KEY);
  const layout: TextLayoutResult | null = useMemo(
    () => (hasText ? shapeButtonLabel(text, fontSizePx, fontMetrics) : null),
    [hasText, text, fontSizePx, fontMetrics]
  );

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
        rtl: solveNode.rtl,
        textNaturalSize: layout
          ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
          : { x: 0, y: 0 },
      }),
    [rect.w, rect.h, theme, iconSize, solveNode.constants, hasText, layout, props.alignment, solveNode.rtl]
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
