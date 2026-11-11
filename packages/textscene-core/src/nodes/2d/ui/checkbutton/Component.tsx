/**
 * `<CheckButton>`, the native (WebGL canvas) painter: a toggle-switch icon, always drawn, at the
 * content margin on the side opposite CheckBox's glyph, beside the label. No chrome: every
 * StyleBox is the same `StyleBoxEmpty`. `ControlCanvasWalker` owns `visible`, the children and
 * the transform.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useCheckButtonIcon } from './useCheckButtonIcon';
import { ButtonLabel, useButtonLabelLayout } from '../../../../r3f/controls/native/ButtonLabel';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { isButtonAutowrapped } from '../../../../r3f/controls/native/buttonBase';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import {
  checkButtonCheckVOffset,
  checkButtonHSeparation,
  checkButtonIconColor,
  checkButtonDrawnIconSize,
  checkButtonFittedIconSize,
  checkButtonLabelWrapWidthPx,
  checkButtonMarginX,
  checkButtonMarginY,
  checkButtonTextTheme,
  layoutCheckButtonContent,
  resolveCheckButtonDrawState,
  resolveCheckButtonIconKey,
  tintColor,
  CHECKBUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import type { CheckButtonProperties } from './types';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';

export function CheckButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<CheckButtonProperties>(solveNode);
  const state = resolveCheckButtonDrawState(props);

  // `renderOrder` reaches both meshes. `<TextRun>` builds its own material, so it takes
  // the clip planes explicitly, while the icon quad reads them itself.
  const clippingPlanes = useControlClipPlanes();

  const iconKey = resolveCheckButtonIconKey(props, solveNode.rtl);
  const iconTexture = useCheckButtonIcon(solveNode, iconKey);
  const iconSize = useMemo(
    () => checkButtonFittedIconSize(solveNode, props.disabled === true),
    [solveNode, props.disabled]
  );
  const drawnIconSize = useMemo(() => checkButtonDrawnIconSize(solveNode, iconKey), [solveNode, iconKey]);

  // Unlike CheckBox's fixed white, the icon colour is a theme key a scene can override, so it
  // takes the tint before its one sRGB-to-linear conversion, as Button's icon does.
  const baseIconColor = checkButtonIconColor(props, solveNode.colors);
  const tintedIconColorSrgb = useMemo(() => tintColor(baseIconColor, tint.own), [baseIconColor, tint.own]);
  const iconLinearColor = useItemLinearColor(tintedIconColorSrgb);

  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = checkButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  const bidi = useControlBidiOptions(props, solveNode);
  const layout = useButtonLabelLayout(solveNode, props, {
    themeFontKey: CHECKBUTTON_THEME_FONT_KEY,
    text,
    fontSizePx,
    bidi,
    boxWidthPx: checkButtonLabelWrapWidthPx(props, rect, solveNode, { theme }),
  });

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
        textHeightPx: layout?.heightPx ?? 0,
        textAlignment: props.alignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
        rtl: solveNode.rtl,
      }),
    [rect.w, rect.h, theme, iconSize, solveNode.constants, hasText, layout, props.alignment, solveNode.rtl]
  );

  return (
    <>
      <PositionedIcon
        rect={{
          x: content.iconPosition.x,
          y: content.iconPosition.y,
          w: drawnIconSize.x,
          h: drawnIconSize.y,
        }}
        texture={iconTexture}
        color={iconLinearColor}
        opacity={tintedIconColorSrgb.a}
        renderOrder={renderOrder}
        canvasKey={renderOrder}
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
