/**
 * `<MenuBar>` — the native (WebGL canvas) painter for `MenuBar`:
 * `MenuBar::_notification(NOTIFICATION_DRAW)` (`scene/gui/menu_bar.cpp:352-359`,
 * `_draw_menu_item:431-518`) — one `normal` StyleBox (unless `flat`) plus one
 * title run per PopupMenu child, laid out with `h_separation` between them,
 * from the leading edge of the bar's own rect: under `is_layout_rtl()` that
 * is the right edge and every item is mirrored inside the bar, and the
 * `normal_mirrored` StyleBox draws where the theme defines one. Every title
 * draws in Godot's plain "normal" mode: see `nativeSolver.ts`'s own doc for
 * why no other draw state is reachable from a static `.tscn`.
 *
 * Tint: the walker's `tint` prop, exactly as `Button`'s painter applies it —
 * `tint.own` (raw sRGB) to `<StyleBoxQuad>`'s `color`, multiplied into the
 * font colour before `<TextRun>`'s own single sRGB→linear conversion.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 *
 * TEXT LAYOUT: calls `nativeSolver.ts`'s `menuBarTitleShapes`, the **solve
 * handoff** share `menuBarMinimumSize` calls too, so the bar's width and its
 * glyphs come from one measurement rather than a duplicate `shapeText` pass
 * every render.
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
  const style = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, 'normal', solveNode.rtl);

  const { fontSizePx, color: baseFontColor } = resolveTextTheme(
    solveNode,
    props,
    MENU_BAR_TEXT_THEME_KEYS,
    { fontSizePx: theme.fontSize, color: BUTTON_DEFAULT_FONT_COLOR }
  );
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  const titles = menuBarTitleShapes(solveNode, theme);

  const clippingPlanes = useControlClipPlanes();
  // menu_bar.cpp:194: `Math::round(4 * scale)`, MenuBar's own theme constant —
  // numerically identical to Button's `theme.separation`, a separate default.
  const hSeparation = solveNode.constants.h_separation ?? theme.separation;

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
