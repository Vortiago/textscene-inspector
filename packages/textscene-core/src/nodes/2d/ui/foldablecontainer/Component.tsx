/**
 * The native painter for `FoldableContainer`: `_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/foldable_container.cpp:267-328`) without hover and focus. It draws the
 * title bar, the arrow, the title text and, unless `folded`, the content `panel`.
 * `ControlCanvasWalker` draws the children.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapedTextSizeWidthPx, soloLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { OverrunBehavior, overrunFlagsForBehavior, trimLineToWidth } from '../../../../r3f/controls/native/text/textOverrun';
import {
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  HORIZONTAL_ALIGNMENT_RIGHT,
  tintColor,
} from '../../../../r3f/controls/native/buttonBase';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import {
  foldableContainerHSeparation,
  foldableContainerTitleShape,
  FOLDABLE_CONTAINER_ARROW_THEME_NAME,
  type FoldableContainerArrow,
} from './nativeSolver';
import { FOLDABLE_CONTAINER_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { TITLE_POSITION_TOP, type FoldableContainerProperties } from './types';

const ARROW_ICON_URL: Record<FoldableContainerArrow, string> = {
  expanded: FOLDABLE_CONTAINER_ICONS.expandedArrow,
  expandedMirrored: FOLDABLE_CONTAINER_ICONS.expandedArrowMirrored,
  folded: FOLDABLE_CONTAINER_ICONS.foldedArrow,
  foldedMirrored: FOLDABLE_CONTAINER_ICONS.foldedArrowMirrored,
};

/** `FoldableContainer::_get_actual_alignment` (`foldable_container.cpp:503-511`): RTL swaps LEFT and RIGHT and leaves every other value alone. */
function actualTitleAlignment(alignment: number, rtl: boolean): number {
  if (!rtl) return alignment;
  if (alignment === HORIZONTAL_ALIGNMENT_RIGHT) return HORIZONTAL_ALIGNMENT_LEFT;
  if (alignment === HORIZONTAL_ALIGNMENT_LEFT) return HORIZONTAL_ALIGNMENT_RIGHT;
  return alignment;
}

export function FoldableContainer({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<FoldableContainerProperties>(solveNode);
  // The solve handoff: the solver sizes the container from this same title shape.
  const title = foldableContainerTitleShape(solveNode, theme);

  const clippingPlanes = useControlClipPlanes();
  // `icon->draw(ci, pos)` passes no modulate (`foldable_container.cpp:310`): the grey is the
  // SVG's fill, so the quad takes the tint alone, as CheckBox's icon does.
  const iconTexture = useNodeIcon(
    solveNode.icons[FOLDABLE_CONTAINER_ARROW_THEME_NAME[title.arrow]],
    ARROW_ICON_URL[title.arrow]
  );
  const tintedFontColor = useMemo(() => tintColor(title.color, tint.own), [title.color, tint.own]);
  const arrowSize = title.arrowSize;
  const hSeparation = foldableContainerHSeparation(theme);

  const titleMargin = title.titleStyle.contentMargin;
  const titleMarginSize = contentMarginSize(title.titleStyle);
  const titleRect: Rect2 = {
    x: 0,
    y: title.titlePosition === TITLE_POSITION_TOP ? 0 : rect.h - title.size.y,
    w: rect.w,
    h: title.size.y,
  };

  // foldable_container.cpp:288: the near-edge margin before centring. This layout does not
  // flip, so it reads `top` for both `title_position`s, which matches a symmetric-margin theme.
  const titleStyleOfs = titleMargin.top;

  const textHeight = title.layout ? title.layout.heightPx : 0;
  const textTopExtra = Math.max((title.size.y - titleMarginSize.y - textHeight) * 0.5, 0);
  const iconTopExtra = Math.max((title.size.y - titleMarginSize.y - arrowSize.y) * 0.5, 0);

  const rtl = solveNode.rtl;
  // foldable_container.cpp:293-300: the arrow sits at the leading edge, which RTL
  // measures from the style's right margin.
  const iconPos = {
    x: rtl ? rect.w - titleMargin.right - arrowSize.x : titleMargin.left,
    y: iconTopExtra + titleStyleOfs,
  };
  const titleTextWidth = rect.w - titleMarginSize.x - arrowSize.x - hSeparation;

  // `text_buf->set_width(title_text_width)` (`foldable_container.cpp:307`) sets the trim
  // `TextParagraph::draw` applies, so the drawn title is the trimmed shape.
  const overrunFlags = useMemo(
    () => overrunFlagsForBehavior(props.titleTextOverrunBehavior ?? OverrunBehavior.NO_TRIMMING),
    [props.titleTextOverrunBehavior]
  );
  const trimmedLayout = useMemo(() => {
    if (!title.layout || !overrunFlags.trim) return title.layout;
    const trimmedLine = trimLineToWidth(title.layout.lines[0]!, Math.max(1, titleTextWidth), overrunFlags, {
      fontMetrics: title.layout.fontMetrics,
      fontSizePx: title.fontSizePx,
    });
    return soloLineLayout(trimmedLine, title.layout);
  }, [title.layout, overrunFlags, titleTextWidth, title.fontSizePx]);

  // `TextLine::set_horizontal_alignment(_get_actual_alignment())` shifts the
  // drawn glyphs within `title_text_width` (`foldable_container.cpp:497,313`).
  const shapedWidth = trimmedLayout ? shapedTextSizeWidthPx(trimmedLayout.widthPx) : 0;
  const extraSpace = Math.max(titleTextWidth - shapedWidth, 0);
  const alignment = actualTitleAlignment(props.titleAlignment ?? HORIZONTAL_ALIGNMENT_LEFT, rtl);
  const alignmentShift =
    alignment === HORIZONTAL_ALIGNMENT_RIGHT
      ? extraSpace
      : alignment === HORIZONTAL_ALIGNMENT_CENTER
        ? Math.floor(extraSpace / 2)
        : 0;

  const textPos = {
    // `title_text_pos.x += rtl ? title_controls_width : icon width + h_sep`
    // (`:296-301`). `title_controls` is never serialised, so RTL adds nothing.
    x: titleMargin.left + (rtl ? 0 : arrowSize.x + hSeparation) + alignmentShift,
    y: titleStyleOfs + textTopExtra,
  };

  const panelRect: Rect2 = {
    x: 0,
    y: title.titlePosition === TITLE_POSITION_TOP ? title.size.y : 0,
    w: rect.w,
    h: rect.h - title.size.y,
  };

  return (
    <>
      {/* `StyleBoxQuad` reads only the size of its rect,
          so the group supplies the offset. */}
      <CanvasItemGroup position={[titleRect.x, -titleRect.y, 0]}>
        <StyleBoxQuad styleBox={title.titleStyle} color={tint.own} rect={titleRect} renderOrder={renderOrder} />
      </CanvasItemGroup>
      <CanvasItemGroup position={[titleRect.x + iconPos.x, -(titleRect.y + iconPos.y), 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={arrowSize.x}
          height={arrowSize.y}
          color={tint.color}
          opacity={tint.opacity}
          map={iconTexture}
        />
      </CanvasItemGroup>
      {trimmedLayout && titleTextWidth > 0 && (
        <CanvasItemGroup position={[titleRect.x + textPos.x, -(titleRect.y + textPos.y), 0]}>
          <TextRun
            layout={trimmedLayout}
            fontSizePx={title.fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {!title.folded && (
        <CanvasItemGroup position={[panelRect.x, -panelRect.y, 0]}>
          <StyleBoxQuad styleBox={title.panelStyle} color={tint.own} rect={panelRect} renderOrder={renderOrder} />
        </CanvasItemGroup>
      )}
    </>
  );
}
