/**
 * `<MenuButton>`, the native painter. `menu_button.cpp` has no `_notification(NOTIFICATION_DRAW)`, so this
 * reassembles `button/Component.tsx`'s chrome, label and icon, with MenuButton's own `font_disabled_color`
 * (`nativeSolver.ts`). Draw state comes only from `disabled`. `ControlCanvasWalker` owns `visible`,
 * `children` and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import {
  resolveButtonDrawState,
  pickButtonStyleBox,
  tintColor,
  layoutButtonContent,
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  VERTICAL_ALIGNMENT_CENTER,
} from '../../../../r3f/controls/native/buttonBase';
import { buttonIconColor, menuButtonLabelShape, menuButtonTextTheme } from './nativeSolver';
import type { MenuButtonProperties } from './types';

interface IconImageLike {
  width?: number;
  height?: number;
}

export function MenuButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<MenuButtonProperties>(solveNode);
  const state = resolveButtonDrawState(props.disabled);

  const baseStyleBox = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, state, solveNode.rtl);

  const clippingPlanes = useControlClipPlanes();

  // Text: theme resolution and shaping
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = menuButtonTextTheme(solveNode, props, state, { theme });
  // `tint.own` goes raw to `<StyleBoxQuad>`'s `color` and multiplies each font and icon colour before
  // its one sRGB-to-linear conversion, as Button's painter does.
  const tintedFontColor = useMemo(
    () => tintColor(baseFontColor, tint.own),
    [baseFontColor, tint.own]
  );

  // The solve-handoff share the minimum-size solver also reads, as in Button's painter.
  const layout: TextLayoutResult | null = menuButtonLabelShape(solveNode, theme);

  // Icon: resolve and load the referenced texture
  const { externalResources, internalResources } = solveNode.resources;
  const { texture: iconSource } = useTexture2D(props.icon, externalResources, internalResources);
  const iconTexture = useCanvas2DTexture(iconSource);

  const iconNaturalSize: Vec2 | null = useMemo(() => {
    if (!props.icon || !iconTexture) return null;
    const image = iconTexture.image as IconImageLike | undefined;
    const w = image?.width ?? 0;
    const h = image?.height ?? 0;
    return w > 0 && h > 0 ? { x: w, y: h } : null;
  }, [props.icon, iconTexture]);

  const baseIconColor = buttonIconColor(solveNode.colors, state);
  const tintedIconColorSrgb = useMemo(
    () => tintColor(baseIconColor, tint.own),
    [baseIconColor, tint.own]
  );
  const iconLinearColor = useGodotLinearColor(tintedIconColorSrgb);

  // Content layout: icon and text placement within the solved rect
  const content = useMemo(
    () =>
      layoutButtonContent({
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: baseStyleBox.contentMargin,
        hSeparation: solveNode.constants.h_separation ?? theme.separation,
        iconMaxWidth: solveNode.constants.icon_max_width ?? 0,
        textAlignment: props.alignment ?? HORIZONTAL_ALIGNMENT_CENTER,
        iconAlignment: props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT,
        verticalIconAlignment: props.verticalIconAlignment ?? VERTICAL_ALIGNMENT_CENTER,
        expandIcon: props.expandIcon === true,
        iconNaturalSize,
        hasText,
        rtl: solveNode.rtl,
        textNaturalSize: layout
          ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
          : { x: 0, y: 0 },
      }),
    [
      rect.w,
      rect.h,
      baseStyleBox.contentMargin,
      solveNode.constants,
      props.alignment,
      props.iconAlignment,
      props.verticalIconAlignment,
      props.expandIcon,
      iconNaturalSize,
      hasText,
      layout,
      theme.separation,
      solveNode.rtl,
    ]
  );

  return (
    <>
      {!props.flat && <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />}
      {content.icon && iconTexture && (
        <CanvasItemGroup position={[content.icon.rect.x, -content.icon.rect.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={content.icon.rect.w}
            height={content.icon.rect.h}
            color={iconLinearColor}
            opacity={tintedIconColorSrgb.a}
            map={iconTexture}
          />
        </CanvasItemGroup>
      )}
      {content.text && layout && (
        <CanvasItemGroup position={[content.text.offset.x, -content.text.offset.y, 0]}>
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
