/**
 * An embedded window's title: one `TextLine` in `title_font` at `title_font_size`, trimmed to the
 * title space with an ellipsis and centred over the window in the `title_height` band
 * (`viewport.cpp:363-379`). The outline draws first, under the text, as a stroked ring (ADR-0040).
 */
import { lazy, useMemo } from 'react';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { TextRun } from '../../../r3f/controls/native/text/TextRun';
import {
  shapeText,
  shapedTextSizeWidthPx,
  soloLineLayout,
} from '../../../r3f/controls/native/text/textLayout';
import { overrunFlagsForBehavior, trimLineToWidth } from '../../../r3f/controls/native/text/textOverrun';
import { resolveNodeFont } from '../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { peekSceneFontMetrics } from '../../../r3f/controls/native/text/sceneFontLoader';
import { isCanvasFontMetrics } from '../../../r3f/controls/native/text/runtimeFontMetrics';
import { PendingSuspense } from '../../../resources/PendingSuspense';
import { resolveTextTheme } from '../../../r3f/controls/native/textTheme';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import { AutowrapMode, OverrunBehavior } from '../../../godot/text/textServerEnums';
import { outlineStrokeWidthPx } from '../../3d/label3d/glyphLayout';
import { canvasSubOrder, type CanvasSlot } from '../../../r3f/canvasItemState';
import { titleOrigin, titleSpace } from './decoration';
import type { WindowThemeDefaults } from './theme';
import type { WindowProperties } from './types';

// Lazy: only an outlined title in the atlas face needs the bundled canvas face's bytes.
const TitleOutlineRing = lazy(() => import('./TitleOutlineRing'));

/** `TextLine::overrun_behavior`'s default (`text_line.h:50`), which the embedder never changes. */
const TITLE_OVERRUN_FLAGS = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);

interface WindowTitleProps {
  solveNode: SolveNode;
  /** The window's width. */
  width: number;
  /** The border drawn this frame, whose minimum width the title space leaves out. */
  border: ResolvedStyleBox;
  closeHOffset: number;
  defaults: WindowThemeDefaults;
  theme: NativeTheme;
  /** The title's slot: the outline at its key, the text in the piece after it. */
  slot: CanvasSlot;
}

export function WindowTitle({
  solveNode,
  width,
  border,
  closeHOffset,
  defaults,
  theme,
  slot,
}: WindowTitleProps) {
  const props = solveNode.node.properties as WindowProperties;
  const { colors, constants } = solveNode;
  const { fontSizePx, color } = resolveTextTheme(
    solveNode,
    props,
    { sizeKey: 'title_font_size', colorKey: 'title_color' },
    { fontSizePx: theme.fontSize, color: defaults.titleColor }
  );
  const font = resolveNodeFont(solveNode, 'title_font');
  const fontMetrics = peekSceneFontMetrics(font, solveNode.path);
  const titleHeight = constants.title_height ?? defaults.titleHeight;
  const outlineSize = constants.title_outline_size ?? defaults.titleOutlineSize;
  const outlineColor = colors.title_outline_modulate ?? defaults.titleOutlineModulate;
  const space = titleSpace(width, { borderMinimumWidth: contentMarginSize(border).x, closeHOffset });

  const layout = useMemo(() => {
    if (space <= 0) return null;
    const shaped = shapeText(props.title, {
      fontSizePx,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 0,
      fontMetrics,
    });
    const line = trimLineToWidth(shaped.lines[0]!, space, TITLE_OVERRUN_FLAGS, { fontMetrics, fontSizePx });
    return soloLineLayout(line, shaped);
  }, [props.title, fontSizePx, fontMetrics, space]);

  if (!layout) return null;
  const origin = titleOrigin({ x: 0, y: 0, w: width, h: 0 }, titleHeight, {
    x: shapedTextSizeWidthPx(layout.widthPx),
    y: layout.heightPx,
  });
  // `outline_size > 0 && font_outline_color.a > 0` (`viewport.cpp:374`).
  const hasOutline = outlineSize > 0 && outlineColor.a > 0;
  const textKey = hasOutline ? canvasSubOrder(slot).key : slot.key;

  return (
    <CanvasItemGroup position={[origin.x, -origin.y, 0]}>
      {hasOutline && isCanvasFontMetrics(layout.fontMetrics) ? (
        <TextRun
          layout={layout}
          fontSizePx={fontSizePx}
          tint={outlineColor}
          strokeWidthPx={outlineStrokeWidthPx(outlineSize)}
          renderOrder={slot.key}
        />
      ) : null}
      {hasOutline && !isCanvasFontMetrics(layout.fontMetrics) ? (
        <PendingSuspense>
          <TitleOutlineRing
            layout={layout}
            font={font}
            fontSizePx={fontSizePx}
            tint={outlineColor}
            outlineSize={outlineSize}
            renderOrder={slot.key}
          />
        </PendingSuspense>
      ) : null}
      <TextRun layout={layout} fontSizePx={fontSizePx} tint={color} renderOrder={textKey} />
    </CanvasItemGroup>
  );
}
