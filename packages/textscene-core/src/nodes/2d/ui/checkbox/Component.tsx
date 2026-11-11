/**
 * `<CheckBox>`, the native (WebGL canvas) painter: the check or radio icon, always drawn
 * (`check_box.cpp::_notification` has no visibility gate), then the label. It draws no chrome:
 * the "normal" StyleBox is a `StyleBoxEmpty`. `ControlCanvasWalker` owns `visible`, the
 * children and the transform.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useCheckBoxIcon } from './useCheckBoxIcon';
import { ButtonLabel, useButtonLabelLayout } from '../../../../r3f/controls/native/ButtonLabel';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { isButtonAutowrapped, tintColor } from '../../../../r3f/controls/native/buttonBase';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import {
  checkBoxDrawnIconSize,
  checkBoxFittedIconSize,
  checkBoxHSeparation,
  checkBoxCheckVOffset,
  checkBoxLabelWrapWidthPx,
  checkBoxTextTheme,
  layoutCheckBoxContent,
  resolveCheckBoxDrawState,
  resolveCheckBoxIconKey,
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
  const iconTexture = useCheckBoxIcon(solveNode, iconKey);
  // Fitted, not rounded: CheckBox draws `_fit_icon_size` as it is (`check_box.cpp:61`, `:140-142`).
  const iconSize = useMemo(() => checkBoxFittedIconSize(solveNode), [solveNode]);
  const drawnIconSize = useMemo(() => checkBoxDrawnIconSize(solveNode, iconKey), [solveNode, iconKey]);

  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = checkBoxTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  const bidi = useControlBidiOptions(props, solveNode);
  const layout = useButtonLabelLayout(solveNode, props, {
    themeFontKey: CHECKBOX_THEME_FONT_KEY,
    text,
    fontSizePx,
    bidi,
    boxWidthPx: checkBoxLabelWrapWidthPx(props, rect, solveNode, { theme }),
  });

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
        // The height sums independently ceiled ascent and descent and an integral spacing.
        textHeightPx: layout?.heightPx ?? 0,
        textAlignment: props.alignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
      }),
    [rect.w, rect.h, theme, iconSize, solveNode.constants, hasText, layout, props.alignment, solveNode.rtl]
  );

  const iconRect = useMemo(
    () => ({ ...content.iconPosition, w: drawnIconSize.x, h: drawnIconSize.y }),
    [content.iconPosition, drawnIconSize.x, drawnIconSize.y]
  );

  // The icon colour is opaque white in both states (`default_theme.cpp:312-313`), and
  // the disabled SVGs carry their own dimming, so the icon takes the tint directly.
  return (
    <>
      <PositionedIcon
        rect={iconRect}
        texture={iconTexture}
        color={tint.color}
        opacity={tint.opacity}
        renderOrder={renderOrder}
      />
      {content.labelBox && layout && (
        <ButtonLabel
          layout={layout}
          overrunBehavior={props.overrunBehavior}
          bidi={bidi}
          isWrapped={isButtonAutowrapped(props)}
          box={content.labelBox}
          fontSizePx={fontSizePx}
          tint={tintedFontColor}
          outline={textOutline}
          clippingPlanes={clippingPlanes}
          renderOrder={renderOrder}
        />
      )}
    </>
  );
}
