/**
 * `<CheckBox>`, the native (WebGL canvas) painter: the check or radio icon, always drawn
 * (`check_box.cpp::_notification` has no visibility gate), then the label. It draws no chrome:
 * the "normal" StyleBox is a `StyleBoxEmpty`. `ControlCanvasWalker` owns `visible`, the
 * children and the transform.
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

  // `renderOrder` reaches both meshes. `<TextRun>` builds its own material, so it takes
  // the clip planes explicitly, while the icon quad reads them itself.
  const clippingPlanes = useControlClipPlanes();

  const iconKey = resolveCheckBoxIconKey(props);
  const iconTexture = useNodeIcon(solveNode.icons[CHECK_BOX_ICON_THEME_NAME[iconKey]], CHECK_BOX_ICONS[iconKey]);
  const iconSize = useMemo(() => {
    const fitted = fitIconSize(checkBoxIconNaturalSize(solveNode), checkBoxIconMaxWidth(solveNode.constants));
    return { x: Math.round(fitted.x), y: Math.round(fitted.y) };
  }, [solveNode]);

  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = checkBoxTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // Read inside the render body, not the `useMemo` below: Label's Component.tsx
  // gives the reason.
  const fontMetrics = resolveNodeFontMetrics(solveNode, CHECKBOX_THEME_FONT_KEY);
  const layout: TextLayoutResult | null = useMemo(
    () =>
      hasText
        ? shapeButtonLabel(text, fontSizePx, fontMetrics)
        : null,
    [hasText, text, fontSizePx, fontMetrics]
  );

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
        // The ceiled width, not the raw pen advance: Godot's draw path reads the same
        // `text_buf->get_size()` as the minimum size (`scene/gui/button.cpp:343,349`). The
        // height sums independently ceiled ascent and descent and an integral spacing.
        textNaturalSize: layout
          ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
          : { x: 0, y: 0 },
      }),
    [rect.w, rect.h, theme, iconSize, solveNode.constants, hasText, layout, solveNode.rtl]
  );

  // The icon colour is opaque white in both states (`default_theme.cpp:312-313`), and
  // the disabled SVGs carry their own dimming, so the icon takes the tint directly.
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
