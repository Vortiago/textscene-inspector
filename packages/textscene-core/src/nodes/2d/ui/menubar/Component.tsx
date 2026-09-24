/**
 * `<MenuBar>`, the native painter for `MenuBar::_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/menu_bar.cpp:352-359`, `_draw_menu_item:431-518`): the `normal` StyleBox unless `flat`, and
 * one title per PopupMenu child in the plain "normal" mode (`nativeSolver.ts`), `h_separation` apart from
 * the leading edge. `ControlCanvasWalker` owns `visible`, `children` and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { pickButtonStyleBox, tintColor } from '../../../../r3f/controls/native/buttonBase';
import { resolveTextTheme } from '../../../../r3f/controls/native/textTheme';
import {
  MENU_BAR_TEXT_THEME_KEYS,
  layoutMenuBarItems,
  menuBarTitleShapes,
} from './nativeSolver';
import { BUTTON_DEFAULT_FONT_COLOR } from '../button/nativeSolver';
import type { MenuBarProperties } from './types';

export function MenuBar({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = painterView<MenuBarProperties>(solveNode);
  // Under `is_layout_rtl()`, `_draw_menu_item` prefers the `normal_mirrored` box where the theme
  // defines one (`menu_bar.cpp:437-500`).
  const style = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, 'normal', solveNode.rtl);

  const { fontSizePx, color: baseFontColor } = resolveTextTheme(
    solveNode,
    props,
    MENU_BAR_TEXT_THEME_KEYS,
    { fontSizePx: theme.fontSize, color: BUTTON_DEFAULT_FONT_COLOR }
  );
  // `tint.own` goes raw to `<StyleBoxQuad>`'s `color` and multiplies the font colour before its one
  // sRGB-to-linear conversion, as in `Button`.
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // The solve-handoff share `menuBarMinimumSize` also reads, so the bar's width and its glyphs come
  // from one measurement.
  const titles = menuBarTitleShapes(solveNode, theme);

  const clippingPlanes = useControlClipPlanes();
  // menu_bar.cpp:194: `Math::round(4 * scale)`, MenuBar's own theme constant, equal to but separate
  // from Button's `theme.separation`.
  const hSeparation = solveNode.constants.h_separation ?? theme.separation;

  // Items run from the leading edge, which RTL moves to the right, mirrored inside the bar.
  const items = layoutMenuBarItems(titles, hSeparation, rect.w, solveNode.rtl);

  return (
    <>
      {items.map(({ title, x }) => (
        <CanvasItemGroup key={title.name} position={[x, 0, 0]}>
          {!props.flat && (
            <StyleBoxQuad
              styleBox={style}
              color={tint.own}
              rect={{ x: 0, y: 0, w: title.size.x, h: title.size.y }}
              renderOrder={renderOrder}
            />
          )}
          <CanvasItemGroup position={[style.contentMargin.left, -style.contentMargin.top, 0]}>
            <TextRun
              layout={title.layout}
              fontSizePx={fontSizePx}
              tint={tintedFontColor}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        </CanvasItemGroup>
      ))}
    </>
  );
}
