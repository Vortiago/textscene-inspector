/**
 * An embedded window's title: one `TextLine` in `title_font` at `title_font_size`, trimmed to the
 * title space with an ellipsis at its end in the window's direction, and centred over the window in
 * the `title_height` band (`viewport.cpp:363-379`). The outline draws first, under the text, as a
 * stroked ring (ADR-0040).
 */
import { useMemo } from 'react';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { OutlinedTextRun } from '../../../r3f/controls/native/text/OutlinedTextRun';
import { shapedTextSizeWidthPx } from '../../../r3f/controls/native/text/textLayout';
import { TEXT_LINE_DEFAULT_OVERRUN, trimSoloLine } from '../../../r3f/controls/native/text/textOverrun';
import { resolveNodeFont } from '../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { peekSceneFontMetrics } from '../../../r3f/controls/native/text/sceneFontLoader';
import { resolveTextTheme } from '../../../r3f/controls/native/textTheme';
import { requiredThemeItem } from '../../../r3f/controls/native/themeItems';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import type { CanvasSlot } from '../../../r3f/canvasItemState';
import { shapeTitle, titleOrigin, titleSpace } from './decoration';
import type { WindowProperties } from './types';

interface WindowTitleProps {
  solveNode: SolveNode;
  /** The window's width. */
  width: number;
  /** The border drawn this frame, whose minimum width the title space leaves out. */
  border: ResolvedStyleBox;
  closeHOffset: number;
  /** The title's slot: the outline and the text draw as layers from its key. */
  slot: CanvasSlot;
}

export function WindowTitle({ solveNode, width, border, closeHOffset, slot }: WindowTitleProps) {
  const props = solveNode.node.properties as WindowProperties;
  const { colors, constants } = solveNode;
  const { fontSizePx, color } = resolveTextTheme(solveNode, props, {
    sizeKey: 'title_font_size',
    colorKey: 'title_color',
  });
  const font = resolveNodeFont(solveNode, 'title_font');
  const fontMetrics = peekSceneFontMetrics(font, solveNode.path);
  const titleHeight = requiredThemeItem(constants, 'title_height');
  const outlineSize = requiredThemeItem(constants, 'title_outline_size');
  const outlineColor = requiredThemeItem(colors, 'title_outline_modulate');
  const space = titleSpace(width, { borderMinimumWidth: contentMarginSize(border).x, closeHOffset });

  const layout = useMemo(() => {
    if (space <= 0) return null;
    const isRtl = solveNode.rtl;
    return trimSoloLine(
      shapeTitle(props.title, { fontSizePx, fontMetrics, isRtl }),
      TEXT_LINE_DEFAULT_OVERRUN,
      space,
      {
        fontMetrics,
        fontSizePx,
        isDrawnRtl: isRtl,
      }
    );
  }, [props.title, fontSizePx, fontMetrics, space, solveNode.rtl]);

  if (!layout) return null;
  const origin = titleOrigin(width, titleHeight, {
    x: shapedTextSizeWidthPx(layout.widthPx),
    y: layout.heightPx,
  });
  // `OutlinedTextRun` draws the ring only at `outline_size > 0 && font_outline_color.a > 0` (`viewport.cpp:374`).
  const outline = { color: outlineColor, sizePx: outlineSize };

  return (
    <CanvasItemGroup position={[origin.x, -origin.y, 0]}>
      <OutlinedTextRun
        layout={layout}
        fontSizePx={fontSizePx}
        tint={color}
        outline={outline}
        renderOrder={slot.key}
      />
    </CanvasItemGroup>
  );
}
