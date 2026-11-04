/**
 * `<ItemList>`, the native (WebGL canvas) painter for `NOTIFICATION_DRAW`
 * (`scene/gui/item_list.cpp:1367-1729`): the panel, the guide lines, each
 * row's icon and label, the scroll hint, then the scrollbars, limited to what a `.tscn` can show (`nativeSolver.ts`).
 * `ControlCanvasWalker` owns `visible`, `children` and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useOwnerCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import {
  ControlClipProvider,
  useControlClipPlanes,
  useWorldClipPlanes,
} from '../../../../r3f/controls/native/controlClipping';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  shapedTextSizeWidthPx,
  soloLineLayout,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SceneScope } from '../../../../parser/types';
import {
  ICON_MODE_LEFT,
  ITEM_LIST_DEFAULT_MAX_COLUMNS,
  ITEM_LIST_THEME_FONT_KEY,
  itemIconColor,
  itemIconDraw,
  itemIconPackedSize,
  itemListGuideColor,
  itemListDrawClip,
  itemListGuideLines,
  itemListIconSlotKey,
  itemListLineTextWidthPx,
  itemListMaxColumnWidth,
  itemListMinimumShapeWidthPx,
  itemListMirrorX,
  itemListRowsInClip,
  itemListRowTextX,
  itemListSeparatorsInClip,
  itemListSeparation,
  itemListTextTheme,
  itemListWrappedTextWidthPx,
  itemMinimumSize,
  itemTextColor,
  itemTextDrawOffset,
  isItemListTextWrapped,
  packItemListRows,
  pickItemListPanelStyleBox,
  shapeItemListText,
} from './nativeSolver';
import { ScrollBarChrome, ScrollHintChrome, SCROLL_HINT_MODULATE } from '../shared/ScrollChrome';
import { scrollBarMinimumSize } from '../shared/scrollBarSolver';
import { itemListScrollBars } from './scrollBars';
import { itemListDrawnLabel, itemListLabelIsDrawn, type DrawnLabelLine } from './labelDraw';
import type { ItemListItem, ItemListProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';

/**
 * `draw_line` without a width is a two-point line: Vulkan lights the pixel within half a pixel of
 * it, and on a tie the one before it. A 1 px quad centred on the line covers that pixel (ADR-0057;
 * measured on a guide line, Godot draws it one row above the separator's Y).
 */
const GUIDE_LINE_CENTRE_OFFSET_PX = 0.5;

/**
 * Pass 1: this row's own icon/text size contribution: what `packItemListRows` needs, before rects
 * exist. `minimumLayout` is the label shaped at the minimum-size width (`item_list.cpp:1763-1766`).
 */
interface RowContent {
  item: ItemListItem;
  disabled: boolean;
  hasIcon: boolean;
  iconSize: Vector2;
  textSize: Vector2;
  minimumLayout: TextLayoutResult | null;
}

/** Pass 2: this row's fully-resolved, plain-data geometry: everything but the async icon load. */
interface RowGeometry {
  item: ItemListItem;
  disabled: boolean;
  hasIcon: boolean;
  iconNaturalSize: Vector2 | null;
  fixedIconSizeSet: boolean;
  iconDraw: ReturnType<typeof itemIconDraw>;
  /** The label shaped again at its draw width (`item_list.cpp:1625-1661`), or `null` when the row draws none. */
  label: { layout: TextLayoutResult; lines: DrawnLabelLine[] } | null;
  /** Row-relative pen x, already through the RTL branch of `item_list.cpp:1639-1670`. */
  textX: number;
  textY: number;
  /** Row-relative icon x, already mirrored (`item_list.cpp:1582-1584`). */
  iconX: number;
  rect: Rect2;
  textColor: Rgba;
}

interface ItemListRowProps {
  geometry: RowGeometry;
  origin: Vector2;
  tint: Rgba;
  renderOrder: number;
  fontSizePx: number;
  resources: SceneScope;
}

/**
 * One row, a component of its own so its `useTexture2D` hook has a stable call
 * site: React forbids a varying hook count. `tint` multiplies the font and icon
 * colour before the one sRGB-to-linear conversion.
 */
function ItemListRow({ geometry, origin, tint, renderOrder, fontSizePx, resources }: ItemListRowProps) {
  const { item, disabled, hasIcon, iconDraw, label, textX, textY, iconX, rect, textColor } = geometry;

  const { texture: iconSource } = useTexture2D(
    item.icon,
    resources.externalResources,
    resources.internalResources
  );
  const iconTexture = useOwnerCanvas2DTexture(iconSource);
  // Inside the list's own `ControlClipProvider`, so a row clips to the list rect.
  const clippingPlanes = useControlClipPlanes();

  const iconColorSrgb = useMemo(() => tintColor(itemIconColor(disabled), tint), [disabled, tint]);
  const iconColorLinear = useGodotLinearColor(iconColorSrgb);
  const tintedTextColor = useMemo(() => tintColor(textColor, tint), [textColor, tint]);

  return (
    <CanvasItemGroup position={[origin.x + rect.x, -(origin.y + rect.y), 0]}>
      {hasIcon && iconDraw.rect && iconTexture && (
        <CanvasItemGroup position={[iconX, -iconDraw.rect.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={iconDraw.rect.w}
            height={iconDraw.rect.h}
            color={iconColorLinear}
            opacity={iconColorSrgb.a}
            map={iconTexture}
          />
        </CanvasItemGroup>
      )}
      {label &&
        label.lines.map(({ line, shiftPx }, index) => (
          <CanvasItemGroup
            key={index}
            position={[textX + shiftPx, -(textY + index * label.layout.linePitchPx), 0]}
          >
            <TextRun
              layout={soloLineLayout(line, label.layout)}
              fontSizePx={fontSizePx}
              tint={tintedTextColor}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}
    </CanvasItemGroup>
  );
}

export function ItemList({
  solveNode,
  tint,
  rect,
  renderOrder,
  theme,
  snapToPixels,
  children,
}: NativeControlComponentProps) {
  const props = painterView<ItemListProperties>(solveNode);
  const items = props.items;

  const iconMode = props.iconMode ?? ICON_MODE_LEFT;
  const maxTextLines = props.maxTextLines ?? 1;
  const fixedColumnWidth = props.fixedColumnWidth ?? 0;
  const iconScale = props.iconScale ?? 1;
  const fixedIconSizeSet = !!(props.fixedIconSize && props.fixedIconSize.x > 0 && props.fixedIconSize.y > 0);

  const panelBox = pickItemListPanelStyleBox(solveNode.styleBoxes, theme);
  const panelMargin = contentMarginSize(panelBox);

  const { fontSizePx, color: baseFontColor } = itemListTextTheme(solveNode, props, { theme });
  const fontMetrics = resolveNodeFontMetrics(solveNode, ITEM_LIST_THEME_FONT_KEY);

  const hSeparation = itemListSeparation(theme);
  const vSeparation = hSeparation;
  const iconMargin = hSeparation;
  const wraparoundItems = props.wraparoundItems !== false;
  // Under RTL the panel and guide lines stay, and only each row's icon and label
  // move (`item_list.cpp:1582-1584,1639-1641,1664-1668`).
  const rtl = solveNode.rtl;

  // `set_clip_contents(true)` (`item_list.cpp:2482`) clips to the list rect, scrollbars aside.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clip } = useWorldClipPlanes(ownRect);
  const clipsContents = props.clipContents !== false;

  const textShape = useMemo(
    () => ({ fontSizePx, fontMetrics, iconMode, maxTextLines, overrunBehavior: props.textOverrunBehavior }),
    [fontSizePx, fontMetrics, iconMode, maxTextLines, props.textOverrunBehavior]
  );

  const rows: RowContent[] = useMemo(() => {
    return items.map((item, index) => {
      const disabled = item.disabled === true;
      const hasIcon = item.icon !== undefined;
      const naturalSize = solveNode.textureSlots[itemListIconSlotKey(index)] ?? null;
      const iconSize = itemIconPackedSize(hasIcon, naturalSize, props.fixedIconSize, iconScale);

      const text = item.text ?? '';
      const minimumLayout = shapeItemListText({
        ...textShape,
        text,
        widthPx: itemListMinimumShapeWidthPx(fixedColumnWidth),
      });
      const textSize = minimumLayout
        ? { x: shapedTextSizeWidthPx(minimumLayout.widthPx), y: minimumLayout.heightPx }
        : { x: 0, y: 0 };

      return { item, disabled, hasIcon, iconSize, textSize, minimumLayout };
    });
  }, [items, textShape, fixedColumnWidth, iconScale, props.fixedIconSize, solveNode]);

  const itemSizes = useMemo(
    () =>
      rows.map((r) =>
        itemMinimumSize(
          {
            hasIcon: r.hasIcon,
            iconSize: r.iconSize,
            hasText: r.minimumLayout !== null,
            textSize: r.textSize,
            iconMode,
            maxTextLines,
            fixedColumnWidth,
          },
          theme
        )
      ),
    [rows, iconMode, maxTextLines, fixedColumnWidth, theme]
  );

  const maxColumnWidth = itemListMaxColumnWidth(itemSizes, hSeparation);
  const pageWidth = rect.w - panelMargin.x;
  const verticalBarMinWidth = useMemo(() => scrollBarMinimumSize(true, theme).x, [theme]);

  const packed = useMemo(
    () =>
      packItemListRows({
        itemSizes,
        maxColumnWidth,
        sameColumnWidth: props.sameColumnWidth === true,
        maxColumns: props.maxColumns ?? ITEM_LIST_DEFAULT_MAX_COLUMNS,
        fitSize: pageWidth,
        verticalBarMinWidth,
        rtl,
        wraparoundItems,
        autoWidth: props.autoWidth === true,
        hSeparation,
        availableHeight: Math.max(0, rect.h - panelMargin.y),
      }),
    [
      itemSizes,
      maxColumnWidth,
      props.sameColumnWidth,
      props.maxColumns,
      pageWidth,
      verticalBarMinWidth,
      rtl,
      rect.h,
      panelMargin.y,
      wraparoundItems,
      props.autoWidth,
      hSeparation,
    ]
  );

  // `base_ofs = theme_cache.panel_style->get_offset()` (`item_list.cpp:1429`):
  // `StyleBox::get_offset()` is `Point2(get_margin(LEFT), get_margin(TOP))`
  // (`style_box.cpp:87-89`), never `contentMarginSize`'s summed pair.
  const origin: Vector2 = { x: panelBox.contentMargin.left, y: panelBox.contentMargin.top };

  // The draw `width` (`item_list.cpp:1385-1389`): a visible vertical bar takes its width off.
  const barWidth = packed.vertical.visible ? verticalBarMinWidth : 0;
  const contentWidth = pageWidth - barWidth;

  // Only what reaches into the list is drawn, which `clip_contents = false` makes visible.
  const drawClip = useMemo(
    () =>
      itemListDrawClip(
        { x: rect.w, y: rect.h },
        { x: origin.x, y: origin.y },
        packed.horizontal,
        wraparoundItems
      ),
    [rect.w, rect.h, origin.x, origin.y, packed.horizontal, wraparoundItems]
  );
  const guideLines = useMemo(
    () =>
      itemListGuideLines(
        iconMode,
        itemListSeparatorsInClip(packed.separators, drawClip),
        contentWidth,
        rtl ? barWidth : 0
      ),
    [iconMode, packed.separators, drawClip, contentWidth, rtl, barWidth]
  );
  const panelMargins = panelBox.contentMargin;
  const scrollBars = useMemo(
    () =>
      itemListScrollBars({
        size: { x: rect.w, y: rect.h },
        margins: panelMargins,
        vertical: packed.vertical,
        horizontal: packed.horizontal,
        rtl,
        theme,
        scrollHintMode: props.scrollHintMode ?? 0,
      }),
    [rect.w, rect.h, panelMargins, packed, rtl, theme, props.scrollHintMode]
  );
  const hintColor = useMemo(() => tint.color.clone().multiply(SCROLL_HINT_MODULATE), [tint.color]);
  const guideColorSrgb = useMemo(
    () => tintColor(itemListGuideColor(solveNode), tint.own),
    [solveNode, tint.own]
  );
  const guideColorLinear = useGodotLinearColor(guideColorSrgb);

  const rowGeometries: RowGeometry[] = useMemo(() => {
    const minimumShapeWidthPx = itemListMinimumShapeWidthPx(fixedColumnWidth);
    // The minimum-size pass already shaped the label at this width, so it is not shaped twice.
    const shapeLabelAt = (r: RowContent, widthPx: number) =>
      widthPx === minimumShapeWidthPx
        ? r.minimumLayout
        : shapeItemListText({ ...textShape, text: r.item.text ?? '', widthPx });
    return rows.map((r, index) => {
      const packedRect = packed.items[index]!.rect;
      // Both centring passes read `rect_cache.SIZE` (`item_list.cpp:1553,1556,1649`),
      // never its position, and a `Rect2` satisfies `Vector2` structurally.
      const packedSize: Vector2 = { x: packedRect.w, y: packedRect.h };
      const naturalSize = solveNode.textureSlots[itemListIconSlotKey(index)] ?? null;
      const iconDraw = itemIconDraw(
        r.hasIcon,
        iconMode,
        r.iconSize,
        naturalSize,
        fixedIconSizeSet,
        packedSize,
        hSeparation,
        vSeparation,
        iconMargin
      );
      const textOffset = itemTextDrawOffset(
        iconMode,
        iconDraw.textOffsetContribution,
        packedSize,
        r.minimumLayout?.heightPx ?? 0,
        hSeparation,
        vSeparation
      );
      // Every RTL branch works in control coordinates; the row group keeps
      // its LTR origin, so each piece comes back relative to it.
      const rowOriginX = origin.x + packedRect.x;
      const wrapped = isItemListTextWrapped(iconMode, maxTextLines);
      const textWidthPx = wrapped
        ? itemListWrappedTextWidthPx(packedRect.w, textOffset.x, contentWidth, wraparoundItems)
        : itemListLineTextWidthPx(packedRect.w, textOffset.x, contentWidth, wraparoundItems);
      const textBoxX = wrapped
        ? itemListMirrorX(rowOriginX + textOffset.x, textWidthPx, rect.w, rtl)
        : itemListRowTextX(
            {
              ltrX: rowOriginX + textOffset.x,
              itemRectWidthPx: packedRect.w,
              iconWidthPx: r.iconSize.x,
              controlWidthPx: rect.w,
              contentWidthPx: contentWidth,
              wraparoundItems,
              hSeparation,
            },
            rtl
          );
      const isLabelDrawn = itemListLabelIsDrawn({
        wrapped,
        fixedColumnWidth,
        itemRectWidthPx: packedRect.w,
        iconWidthPx: r.iconSize.x,
        contentWidthPx: contentWidth,
        wraparoundItems,
        hSeparation,
      });
      const layout = isLabelDrawn ? shapeLabelAt(r, textWidthPx) : null;
      const label = layout ? { layout, lines: itemListDrawnLabel(layout, textWidthPx, wrapped, rtl) } : null;
      return {
        item: r.item,
        disabled: r.disabled,
        hasIcon: r.hasIcon,
        iconNaturalSize: naturalSize,
        fixedIconSizeSet,
        iconDraw,
        label,
        textX: textBoxX - rowOriginX,
        textY: textOffset.y,
        iconX: iconDraw.rect
          ? itemListMirrorX(rowOriginX + iconDraw.rect.x, iconDraw.rect.w, rect.w, rtl) - rowOriginX
          : 0,
        rect: packedRect,
        textColor: itemTextColor(baseFontColor, r.disabled),
      };
    });
  }, [
    rows,
    packed,
    iconMode,
    maxTextLines,
    fixedColumnWidth,
    textShape,
    fixedIconSizeSet,
    hSeparation,
    vSeparation,
    iconMargin,
    solveNode,
    baseFontColor,
    origin.x,
    rect.w,
    contentWidth,
    wraparoundItems,
    rtl,
  ]);

  const visibleRows = useMemo(() => itemListRowsInClip(rowGeometries, drawClip), [rowGeometries, drawClip]);

  const rowsAndChildren = (
    <>
      {guideLines.map((line, index) => (
        <CanvasItemGroup
          key={`guide-${index}`}
          position={[origin.x + line.x, -(origin.y + line.y - GUIDE_LINE_CENTRE_OFFSET_PX), 0]}
        >
          <ControlQuad
            renderOrder={renderOrder}
            width={line.width}
            height={1}
            color={guideColorLinear}
            opacity={guideColorSrgb.a}
          />
        </CanvasItemGroup>
      ))}
      {visibleRows.map((geometry, index) => (
        <ItemListRow
          key={index}
          geometry={geometry}
          origin={origin}
          tint={tint.own}
          renderOrder={renderOrder}
          fontSizePx={fontSizePx}
          resources={solveNode.resources}
        />
      ))}
      <ScrollHintChrome
        hint={scrollBars.bottomHint}
        color={hintColor}
        opacity={tint.opacity}
        chromeRenderOrder={renderOrder}
      />
      <ScrollBarChrome
        bar={scrollBars.horizontal}
        track={theme.widgets.scrollBar.scrollHorizontal}
        grabber={theme.widgets.scrollBar.grabber}
        color={tint.own}
        chromeRenderOrder={renderOrder}
        snapToPixels={snapToPixels}
      />
      <ScrollBarChrome
        bar={scrollBars.vertical}
        track={theme.widgets.scrollBar.scrollVertical}
        grabber={theme.widgets.scrollBar.grabber}
        color={tint.own}
        chromeRenderOrder={renderOrder}
        snapToPixels={snapToPixels}
      />
      {children}
    </>
  );

  return (
    <CanvasItemGroup ref={anchorRef}>
      <StyleBoxQuad styleBox={panelBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      {clipsContents ? (
        <ControlClipProvider value={clip}>{rowsAndChildren}</ControlClipProvider>
      ) : (
        rowsAndChildren
      )}
    </CanvasItemGroup>
  );
}
