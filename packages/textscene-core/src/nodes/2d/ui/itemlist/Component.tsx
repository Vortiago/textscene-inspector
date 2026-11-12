/**
 * `<ItemList>`, the native (WebGL canvas) painter for `NOTIFICATION_DRAW`
 * (`scene/gui/item_list.cpp:1367-1729`): the panel, the guide lines, each
 * row's icon and label, the scroll hint, then the scrollbars, limited to what a `.tscn` can show (`nativeSolver.ts`).
 * `ControlCanvasWalker` owns `visible`, `children` and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useOwnerCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { hairlineQuadStartPx } from '../../../../r3f/controls/native/hairline';
import {
  ControlClipProvider,
  useControlClipPlanes,
  useWorldClipPlanes,
} from '../../../../r3f/controls/native/controlClipping';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  OutlinedTextRun,
  TextOutlineRing,
  useTintedTextOutline,
} from '../../../../r3f/controls/native/text/OutlinedTextRun';
import type { TextOutlineTheme } from '../../../../r3f/controls/native/textTheme';
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
  itemHasIcon,
  itemIconColor,
  itemIconDraw,
  itemIconPackedSize,
  itemListGuideColor,
  itemListBarMinimums,
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
  itemListCursorRect,
  itemListDrawsCursor,
  itemListSelectedFontColor,
  pickItemListCursorStyleBox,
  itemListSelectedRect,
  itemTextColor,
  pickItemListSelectedStyleBox,
  itemTextDrawOffset,
  isItemListTextWrapped,
  packItemListRows,
  pickItemListPanelStyleBox,
  shapeItemListText,
} from './nativeSolver';
import { ScrollBarChrome, ScrollHintChrome, SCROLL_HINT_MODULATE } from '../shared/ScrollChrome';
import { itemListScrollBars } from './scrollBars';
import { itemListDrawnLabel, isItemListLabelFillDrawn } from './labelDraw';
import type { ItemListRuntimeItem, ItemListRuntimeProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';

/**
 * Pass 1: this row's own icon/text size contribution: what `packItemListRows` needs, before rects
 * exist. `minimumLayout` is the label shaped at the minimum-size width (`item_list.cpp:1763-1766`).
 */
interface RowContent {
  item: ItemListRuntimeItem;
  disabled: boolean;
  hasIcon: boolean;
  iconSize: Vector2;
  textSize: Vector2;
  minimumLayout: TextLayoutResult | null;
}

/** One drawn line of a row's label: its own layout, and the alignment shift `TextParagraph::draw` gave it. */
interface DrawnLabelLine {
  lineLayout: TextLayoutResult;
  shiftPx: number;
}

/** Pass 2: this row's fully-resolved, plain-data geometry: everything but the async icon load. */
interface RowGeometry {
  /** The row's place in the list: its React key, which a repack that moves the row leaves unchanged. */
  index: number;
  item: ItemListRuntimeItem;
  disabled: boolean;
  hasIcon: boolean;
  iconDraw: ReturnType<typeof itemIconDraw>;
  /** The label shaped again at its draw width (`item_list.cpp:1625-1661`), or `null` for an item with no text. */
  label: { linePitchPx: number; lines: DrawnLabelLine[] } | null;
  /** Row-relative pen x, already through the RTL branch of `item_list.cpp:1639-1670`. */
  textX: number;
  textY: number;
  /** Row-relative icon x, already mirrored (`item_list.cpp:1582-1584`). */
  iconX: number;
  /** False where the row hides its fill and draws the outline alone (`item_list.cpp:1672-1688`). */
  isTextFillDrawn: boolean;
  rect: Rect2;
  textColor: Rgba;
  /** The background of a selected row, relative to the row's origin, or `null` for a row not selected. */
  selectedRect: Rect2 | null;
  /** The `cursor` box of the current row of a multi-select list, relative to the row's origin, or `null`. */
  cursorRect: Rect2 | null;
}

interface ItemListRowProps {
  geometry: RowGeometry;
  origin: Vector2;
  tint: Rgba;
  /** Tinted by the list, not by the item: `draw_outline` takes the theme colour (`item_list.cpp:1643`). */
  outline: TextOutlineTheme;
  renderOrder: number;
  fontSizePx: number;
  resources: SceneScope;
  /** The list's `selected` StyleBox, drawn behind a selected row. */
  selectedBox: StyleBoxFlatData;
  icons: SolveNode['icons'];
}

/**
 * One row, a component of its own so its `useTexture2D` hook has a stable call
 * site: React forbids a varying hook count. `tint` multiplies the font and icon
 * colour before the one sRGB-to-linear conversion.
 */
function ItemListRow({
  geometry,
  origin,
  tint,
  outline,
  renderOrder,
  fontSizePx,
  resources,
  selectedBox,
  icons,
}: ItemListRowProps) {
  const {
    item,
    disabled,
    hasIcon,
    iconDraw,
    label,
    textX,
    textY,
    iconX,
    isTextFillDrawn,
    rect,
    textColor,
    selectedRect,
  } = geometry;

  const { texture: iconSource } = useTexture2D(
    item.icon,
    resources.externalResources,
    resources.internalResources
  );
  const ownIconTexture = useOwnerCanvas2DTexture(iconSource);
  const themedTexture = useNodeIcon(
    item.themedIcon && icons[item.themedIcon.name],
    item.themedIcon?.vendoredUrl ?? null
  );
  const iconTexture = item.themedIcon ? themedTexture : ownIconTexture;
  // Inside the list's own `ControlClipProvider`, so a row clips to the list rect.
  const clippingPlanes = useControlClipPlanes();

  const iconColorSrgb = useMemo(
    () => tintColor(itemIconColor(disabled, item.iconModulate), tint),
    [disabled, item.iconModulate, tint]
  );
  const iconColorLinear = useItemLinearColor(iconColorSrgb);
  const tintedTextColor = useMemo(() => tintColor(textColor, tint), [textColor, tint]);
  const run = { fontSizePx, outline, clippingPlanes, renderOrder };

  return (
    <CanvasItemGroup position={[origin.x + rect.x, -(origin.y + rect.y), 0]}>
      {selectedRect && (
        <StyleBoxQuad styleBox={selectedBox} color={tint} rect={selectedRect} renderOrder={renderOrder} />
      )}
      {hasIcon && iconDraw.rect && iconTexture && (
        <PositionedIcon
          rect={{ ...iconDraw.rect, x: iconX }}
          texture={iconTexture}
          color={iconColorLinear}
          opacity={iconColorSrgb.a}
          renderOrder={renderOrder}
          canvasKey={renderOrder}
        />
      )}
      {label &&
        label.lines.map(({ lineLayout, shiftPx }, index) => (
          <CanvasItemGroup key={index} position={[textX + shiftPx, -(textY + index * label.linePitchPx), 0]}>
            {isTextFillDrawn ? (
              <OutlinedTextRun {...run} layout={lineLayout} tint={tintedTextColor} />
            ) : (
              <TextOutlineRing {...run} layout={lineLayout} />
            )}
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
  slot,
  theme,
  snapToPixels,
  children,
}: NativeControlComponentProps) {
  const props = painterView<ItemListRuntimeProperties>(solveNode);
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

  const selectedFontColor = itemListSelectedFontColor(solveNode);
  const selectedBox = pickItemListSelectedStyleBox(solveNode.styleBoxes, theme);
  const cursorBox = pickItemListCursorStyleBox(solveNode.styleBoxes, theme);
  const drawsCursor = itemListDrawsCursor(props.selectMode ?? 0);

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
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  const textShape = useMemo(
    () => ({
      fontSizePx,
      fontMetrics,
      iconMode,
      maxTextLines,
      overrunBehavior: props.textOverrunBehavior,
      locale: solveNode.locale,
    }),
    [fontSizePx, fontMetrics, iconMode, maxTextLines, props.textOverrunBehavior, solveNode.locale]
  );

  const rows: RowContent[] = useMemo(() => {
    return items.map((item, index) => {
      const disabled = item.disabled === true;
      const hasIcon = itemHasIcon(item);
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
  const verticalBarMinWidth = useMemo(() => itemListBarMinimums(theme).verticalWidth, [theme]);

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
  const panelMargins = panelBox.contentMargin;
  const origin: Vector2 = { x: panelMargins.left, y: panelMargins.top };

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
  const guideColorLinear = useItemLinearColor(guideColorSrgb);

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
      const wrapped = isItemListTextWrapped(iconMode, maxTextLines);
      const textOffset = itemTextDrawOffset(
        wrapped,
        iconDraw.textOffsetContribution,
        packedSize,
        r.minimumLayout?.heightPx ?? 0,
        hSeparation,
        vSeparation
      );
      // Every RTL branch works in control coordinates; the row group keeps
      // its LTR origin, so each piece comes back relative to it.
      const rowOriginX = origin.x + packedRect.x;
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
      const isTextFillDrawn = isItemListLabelFillDrawn({
        wrapped,
        fixedColumnWidth,
        itemRectWidthPx: packedRect.w,
        iconWidthPx: r.iconSize.x,
        contentWidthPx: contentWidth,
        wraparoundItems,
        hSeparation,
      });
      const layout = shapeLabelAt(r, textWidthPx);
      const label = layout && {
        linePitchPx: layout.linePitchPx,
        // One layout object per line, made here, so a line keeps its meshes across renders.
        lines: itemListDrawnLabel(layout, textWidthPx, wrapped, rtl).map(({ line, shiftPx }) => ({
          lineLayout: soloLineLayout(line, layout),
          shiftPx,
        })),
      };
      return {
        index,
        item: r.item,
        disabled: r.disabled,
        hasIcon: r.hasIcon,
        iconDraw,
        label,
        isTextFillDrawn,
        textX: textBoxX - rowOriginX,
        textY: textOffset.y,
        iconX: iconDraw.rect
          ? itemListMirrorX(rowOriginX + iconDraw.rect.x, iconDraw.rect.w, rect.w, rtl) - rowOriginX
          : 0,
        rect: packedRect,
        textColor: itemTextColor(r.item.isSelected ? selectedFontColor : baseFontColor, r.disabled),
        selectedRect: r.item.isSelected
          ? itemListSelectedRect({
              rowRect: packedRect,
              baseX: origin.x,
              columnCount: packed.columnCount,
              contentWidth,
              controlWidth: rect.w,
              panelMarginLeft: panelMargins.left,
              panelMarginRight: panelMargins.right,
              rtl,
            })
          : null,
        cursorRect:
          r.item.isCurrent && drawsCursor
            ? itemListCursorRect({
                rowRect: packedRect,
                baseX: origin.x,
                columnCount: packed.columnCount,
                contentWidth,
                controlWidth: rect.w,
                rtl,
              })
            : null,
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
    selectedFontColor,
    drawsCursor,
    panelMargins.left,
    panelMargins.right,
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
          position={[origin.x + line.x, -hairlineQuadStartPx(origin.y + line.y), 0]}
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
      {visibleRows.map((geometry) => (
        <ItemListRow
          key={geometry.index}
          geometry={geometry}
          origin={origin}
          tint={tint.own}
          outline={textOutline}
          renderOrder={renderOrder}
          fontSizePx={fontSizePx}
          resources={solveNode.resources}
          selectedBox={selectedBox}
          icons={solveNode.icons}
        />
      ))}
      {visibleRows.map(
        (geometry) =>
          geometry.cursorRect && (
            <CanvasItemGroup
              key={`cursor-${geometry.index}`}
              position={[origin.x + geometry.rect.x, -(origin.y + geometry.rect.y), 0]}
            >
              <StyleBoxQuad
                styleBox={cursorBox}
                color={tint.own}
                rect={geometry.cursorRect}
                renderOrder={renderOrder}
              />
            </CanvasItemGroup>
          )
      )}
      <ScrollHintChrome
        hint={scrollBars.bottomHint}
        color={hintColor}
        opacity={tint.opacity}
        chromeSlot={slot}
      />
      <ScrollBarChrome
        bar={scrollBars.horizontal}
        track={theme.widgets.scrollBar.scrollHorizontal}
        grabber={theme.widgets.scrollBar.grabber}
        color={tint.own}
        chromeSlot={slot}
        snapToPixels={snapToPixels}
      />
      <ScrollBarChrome
        bar={scrollBars.vertical}
        track={theme.widgets.scrollBar.scrollVertical}
        grabber={theme.widgets.scrollBar.grabber}
        color={tint.own}
        chromeSlot={slot}
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
