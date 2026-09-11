/**
 * `<MenuBar>` — the native (WebGL canvas) painter for `MenuBar`:
 * `MenuBar::_notification(NOTIFICATION_DRAW)` (`scene/gui/menu_bar.cpp:352-359`,
 * `_draw_menu_item:431-518`) — one `normal` StyleBox (unless `flat`) plus one
 * title run per PopupMenu child, laid out left to right with `h_separation`
 * between them. Every title draws in Godot's plain "normal" mode: see
 * `nativeSolver.ts`'s own doc for why no other draw state is reachable from a
 * static `.tscn`.
 *
 * Tint: the walker's `tint` prop, exactly as `Button`'s painter applies it —
 * `tint.own` (raw sRGB) to `<StyleBoxQuad>`'s `color`, multiplied into the
 * font colour before `<TextRun>`'s own single sRGB→linear conversion.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 *
 * TEXT LAYOUT: reads `meta` (`nativeSolver.ts`'s `menuBarMinimumSize`) when it
 * is a usable `MenuBarTitle[]` — the SAME shaping the solve already ran,
 * avoiding a duplicate `shapeText` pass every render. Falls back to shaping
 * locally (same inputs, same function) only when `meta` is not that shape —
 * a hand-built test props object, or a solve whose measurer was unavailable.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { isTextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { pickButtonStyleBox, tintColor } from '../../../../r3f/controls/native/buttonBase';
import { resolveTextTheme } from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  MENU_BAR_TEXT_THEME_KEYS,
  MENU_BAR_THEME_FONT_KEY,
  menuBarTitles,
  type MenuBarTitle,
} from './nativeSolver';
import { BUTTON_DEFAULT_FONT_COLOR } from '../button/nativeSolver';
import type { MenuBarProperties } from './types';

function isMenuBarTitleArray(meta: unknown): meta is MenuBarTitle[] {
  if (!Array.isArray(meta)) return false;
  if (meta.length === 0) return true;
  const first: unknown = meta[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    typeof (first as Partial<MenuBarTitle>).name === 'string' &&
    isTextLayoutResult((first as Partial<MenuBarTitle>).layout)
  );
}

export function MenuBar({ solveNode, tint, theme, renderOrder, meta }: NativeControlComponentProps) {
  const props = painterView<MenuBarProperties>(solveNode);
  const style = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, 'normal');
  const marginSize = contentMarginSize(style);

  const { fontSizePx, color: baseFontColor } = resolveTextTheme(
    solveNode,
    props,
    MENU_BAR_TEXT_THEME_KEYS,
    { fontSizePx: theme.fontSize, color: BUTTON_DEFAULT_FONT_COLOR }
  );
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const fontMetrics = resolveNodeFontMetrics(solveNode, MENU_BAR_THEME_FONT_KEY);

  const titles = useMemo(() => {
    if (isMenuBarTitleArray(meta)) return meta;
    return menuBarTitles(solveNode, fontSizePx, fontMetrics, marginSize);
  }, [meta, solveNode, fontSizePx, fontMetrics, marginSize]);

  const clippingPlanes = useControlClipPlanes();
  // menu_bar.cpp:194: `Math::round(4 * scale)`, MenuBar's own theme constant —
  // numerically identical to Button's `theme.separation`, a separate default.
  const hSeparation = props.themeOverrideConstants?.h_separation ?? theme.separation;

  let offset = 0;
  const items = titles.map((title) => {
    const x = offset;
    offset += title.size.x + hSeparation;
    return { title, x };
  });

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
