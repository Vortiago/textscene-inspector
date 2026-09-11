/**
 * `<FoldableContainer>` — the native (WebGL canvas) painter for
 * `FoldableContainer`: `_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/foldable_container.cpp:267-328`), minus RTL, hover and focus
 * (a static viewer never reaches any of the three — see `nativeSolver.ts`'s
 * own doc). Its content Controls are never drawn here — `ControlCanvasWalker`
 * renders them as siblings, already positioned by `foldableContainerLayout`
 * (or nowhere, when `folded`).
 *
 * Draws, in order: the title bar StyleBox (`title_panel`/
 * `title_collapsed_panel`), the fold-state arrow icon, the title text
 * (shifted right of the icon per `title_alignment`, within the space the
 * icon/separator leave), and — only when NOT `folded` — the content `panel`
 * StyleBox behind where the children sit.
 *
 * Tint: the walker's `tint` prop, exactly as every other native painter here
 * applies it — `tint.own` (raw sRGB) to each `<StyleBoxQuad>`'s `color`, and
 * multiplied into the title font colour before `<TextRun>`'s own single
 * sRGB→linear conversion. The arrow icon's own theme colour is unconditional
 * opaque white (`icon->draw(ci, pos)` passes no modulate,
 * `foldable_container.cpp:310`) — its grey comes from the vendored SVG's own
 * fill, not a runtime multiply — so its quad reads `tint.color`/`tint.opacity`
 * directly, the same shape `CheckBox`'s own icon uses for the identical reason.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 *
 * TEXT LAYOUT: reads `meta` (`nativeSolver.ts`'s `foldableContainerMinimumSize`)
 * when it is a usable `FoldableContainerTitleMetrics`, falling back to a local
 * recompute only when it is not (a hand-built test props object, or a solve
 * whose measurer was unavailable) — the SAME contract every other native
 * painter here documents.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import {
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  HORIZONTAL_ALIGNMENT_RIGHT,
  tintColor,
} from '../../../../r3f/controls/native/buttonBase';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import {
  FOLDABLE_CONTAINER_ARROW_SIZE,
  FOLDABLE_CONTAINER_H_SEPARATION,
  foldableContainerTitleMetrics,
  type FoldableContainerArrow,
  type FoldableContainerTitleMetrics,
} from './nativeSolver';
import { FOLDABLE_CONTAINER_ICONS } from './icons';
import { TITLE_POSITION_TOP, type FoldableContainerProperties } from './types';

function isFoldableContainerTitleMetrics(meta: unknown): meta is FoldableContainerTitleMetrics {
  if (typeof meta !== 'object' || meta === null) return false;
  const m = meta as Partial<FoldableContainerTitleMetrics>;
  return typeof m.folded === 'boolean' && typeof m.arrow === 'string' && m.size !== undefined;
}

const ARROW_ICON_URL: Record<FoldableContainerArrow, string> = {
  expanded: FOLDABLE_CONTAINER_ICONS.expandedArrow,
  expandedMirrored: FOLDABLE_CONTAINER_ICONS.expandedArrowMirrored,
  folded: FOLDABLE_CONTAINER_ICONS.foldedArrow,
};

export function FoldableContainer({ solveNode, tint, rect, renderOrder, theme, meta }: NativeControlComponentProps) {
  const props = painterView<FoldableContainerProperties>(solveNode);
  const title = useMemo(
    () =>
      isFoldableContainerTitleMetrics(meta)
        ? meta
        : foldableContainerTitleMetrics(solveNode, props, { theme }, true),
    [meta, solveNode, props, theme]
  );

  const clippingPlanes = useControlClipPlanes();
  const iconTexture = useIconTexture(ARROW_ICON_URL[title.arrow]);
  const tintedFontColor = useMemo(() => tintColor(title.color, tint.own), [title.color, tint.own]);

  const titleMargin = title.titleStyle.contentMargin;
  const titleMarginSize = contentMarginSize(title.titleStyle);
  const titleRect: Rect2 = {
    x: 0,
    y: title.titlePosition === TITLE_POSITION_TOP ? 0 : rect.h - title.size.y,
    w: rect.w,
    h: title.size.y,
  };

  // foldable_container.cpp:288: the near-edge margin before centring — the
  // SAME value for both `title_position`s in the common symmetric-margin
  // theme, since this direct (non-flipped) layout reads `top` unconditionally
  // rather than the source's flip-space `TOP`-vs-`BOTTOM` branch (module doc).
  const titleStyleOfs = titleMargin.top;

  const textHeight = title.layout ? title.layout.heightPx : 0;
  const textTopExtra = Math.max((title.size.y - titleMarginSize.y - textHeight) * 0.5, 0);
  const iconTopExtra = Math.max((title.size.y - titleMarginSize.y - FOLDABLE_CONTAINER_ARROW_SIZE.y) * 0.5, 0);

  const iconPos = { x: titleMargin.left, y: iconTopExtra + titleStyleOfs };
  const titleTextWidth = rect.w - titleMarginSize.x - FOLDABLE_CONTAINER_ARROW_SIZE.x - FOLDABLE_CONTAINER_H_SEPARATION;

  // `TextLine::set_horizontal_alignment(_get_actual_alignment())` shifts the
  // drawn glyphs within `title_text_width` (`foldable_container.cpp:497,313`);
  // `_get_actual_alignment`'s RTL LEFT/RIGHT swap is not modelled (module doc).
  const shapedWidth = title.layout ? shapedTextSizeWidthPx(title.layout.widthPx) : 0;
  const extraSpace = Math.max(titleTextWidth - shapedWidth, 0);
  const alignment = props.titleAlignment ?? HORIZONTAL_ALIGNMENT_LEFT;
  const alignmentShift =
    alignment === HORIZONTAL_ALIGNMENT_RIGHT
      ? extraSpace
      : alignment === HORIZONTAL_ALIGNMENT_CENTER
        ? Math.floor(extraSpace / 2)
        : 0;

  const textPos = {
    x: titleMargin.left + FOLDABLE_CONTAINER_ARROW_SIZE.x + FOLDABLE_CONTAINER_H_SEPARATION + alignmentShift,
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
      <StyleBoxQuad styleBox={title.titleStyle} color={tint.own} rect={titleRect} renderOrder={renderOrder} />
      <CanvasItemGroup position={[titleRect.x + iconPos.x, -(titleRect.y + iconPos.y), 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={FOLDABLE_CONTAINER_ARROW_SIZE.x}
          height={FOLDABLE_CONTAINER_ARROW_SIZE.y}
          color={tint.color}
          opacity={tint.opacity}
          map={iconTexture}
        />
      </CanvasItemGroup>
      {title.layout && titleTextWidth > 0 && (
        <CanvasItemGroup position={[titleRect.x + textPos.x, -(titleRect.y + textPos.y), 0]}>
          <TextRun
            layout={title.layout}
            fontSizePx={title.fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {!title.folded && (
        <StyleBoxQuad styleBox={title.panelStyle} color={tint.own} rect={panelRect} renderOrder={renderOrder} />
      )}
    </>
  );
}
