/**
 * `<ItemList>` — the native (WebGL canvas) painter for `ItemList`: the panel
 * StyleBox, then each row's icon and label — `ItemList::_notification`'s
 * `NOTIFICATION_DRAW` (`scene/gui/item_list.cpp:1367-1729`), restricted to
 * what a static `.tscn` can ever show (`nativeSolver.ts`'s own doc has the
 * full list: no selection/hover/cursor/focus, no scroll hint, no row/column
 * guide lines, no `custom_bg`/`custom_fg`/`icon_modulate`/`icon_region`/
 * `icon_transposed` — none of those five is a serialisable leaf).
 *
 * Each row is its OWN subcomponent (`<ItemListRow>`) purely so its icon's
 * `useTexture2D` hook has a stable per-row call site — `items.length` varies
 * per node, and React forbids a variable number of hook calls in ONE
 * component body. Every OTHER per-row number (rect, shaped text, icon size)
 * is computed ONCE, up front, as plain data — `packItemListRows`'s own
 * pure packing pass — so the row component only owns the async icon load.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. `tint.own` reaches the panel `<StyleBoxQuad>` and is
 * multiplied into each row's own font/icon colour BEFORE each item's own
 * single sRGB→linear conversion — `Button`'s established ordering.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  shapedTextSizeWidthPx,
  soloLineLayout,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SceneScope } from '../../../../parser/types';
import type { ControlColor } from '../control/types';
import {
  ICON_MODE_LEFT,
  ITEM_LIST_DEFAULT_MAX_COLUMNS,
  ITEM_LIST_THEME_FONT_KEY,
  itemIconColor,
  itemIconDraw,
  itemIconPackedSize,
  itemListGuideColor,
  itemListGuideLines,
  itemListIconSlotKey,
  itemListSeparation,
  itemListTextTheme,
  itemMinimumSize,
  itemTextColor,
  itemTextDrawOffset,
  itemTextLineCenterOffset,
  packItemListRows,
  pickItemListPanelStyleBox,
  shapeItemListText,
} from './nativeSolver';
import type { ItemListItem, ItemListProperties } from './types';

/** Pass 1: this row's own icon/text SIZE contribution — what `packItemListRows` needs, before rects exist. */
interface RowContent {
  item: ItemListItem;
  disabled: boolean;
  hasIcon: boolean;
  iconSize: Vec2;
  hasText: boolean;
  textSize: Vec2;
  textLayout: TextLayoutResult | null;
}

/** Pass 2: this row's fully-resolved, plain-data geometry — everything but the async icon load. */
interface RowGeometry {
  item: ItemListItem;
  disabled: boolean;
  hasIcon: boolean;
  iconNaturalSize: Vec2 | null;
  fixedIconSizeSet: boolean;
  iconDraw: ReturnType<typeof itemIconDraw>;
  textLayout: TextLayoutResult | null;
  textOffset: Vec2;
  centerWidth: number;
  iconMode: number;
  rect: Rect2;
  textColor: ControlColor;
}

interface ItemListRowProps {
  geometry: RowGeometry;
  origin: Vec2;
  tint: ControlColor;
  renderOrder: number;
  clippingPlanes: readonly THREE.Plane[];
  fontSizePx: number;
  resources: SceneScope;
}

function ItemListRow({ geometry, origin, tint, renderOrder, clippingPlanes, fontSizePx, resources }: ItemListRowProps) {
  const { item, disabled, hasIcon, iconDraw, textLayout, textOffset, centerWidth, iconMode, rect, textColor } = geometry;

  const { texture: iconSource } = useTexture2D(item.icon, resources.externalResources, resources.internalResources);
  const iconTexture = useCanvas2DTexture(iconSource);

  const iconColorSrgb = useMemo(() => tintColor(itemIconColor(disabled), tint), [disabled, tint]);
  const iconColorLinear = useGodotLinearColor(iconColorSrgb);
  const tintedTextColor = useMemo(() => tintColor(textColor, tint), [textColor, tint]);

  return (
    <CanvasItemGroup position={[origin.x + rect.x, -(origin.y + rect.y), 0]}>
      {hasIcon && iconDraw.rect && iconTexture && (
        <CanvasItemGroup position={[iconDraw.rect.x, -iconDraw.rect.y, 0]}>
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
      {textLayout &&
        (iconMode === ICON_MODE_LEFT ? (
          <CanvasItemGroup position={[textOffset.x, -textOffset.y, 0]}>
            <TextRun
              layout={textLayout}
              fontSizePx={fontSizePx}
              tint={tintedTextColor}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ) : (
          textLayout.lines.map((line, index) => (
            <CanvasItemGroup
              key={index}
              position={[
                textOffset.x + itemTextLineCenterOffset(centerWidth, shapedTextSizeWidthPx(line.widthPx)),
                -(textOffset.y + index * textLayout.linePitchPx),
                0,
              ]}
            >
              <TextRun
                layout={soloLineLayout(line, textLayout)}
                fontSizePx={fontSizePx}
                tint={tintedTextColor}
                clippingPlanes={clippingPlanes}
                renderOrder={renderOrder}
              />
            </CanvasItemGroup>
          ))
        ))}
    </CanvasItemGroup>
  );
}

export function ItemList({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
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

  const clippingPlanes = useControlClipPlanes();

  const rows: RowContent[] = useMemo(() => {
    return items.map((item, index) => {
      const disabled = item.disabled === true;
      const hasIcon = item.icon !== undefined;
      const naturalSize = solveNode.textureSlots[itemListIconSlotKey(index)] ?? null;
      const iconSize = itemIconPackedSize(hasIcon, naturalSize, props.fixedIconSize, iconScale);

      const text = item.text ?? '';
      const hasText = text.length > 0;
      const textLayout = hasText
        ? shapeItemListText({ text, fontSizePx, fontMetrics, iconMode, maxTextLines, fixedColumnWidth, overrunBehavior: props.textOverrunBehavior })
        : null;
      const textSize = textLayout
        ? { x: shapedTextSizeWidthPx(textLayout.widthPx), y: textLayout.heightPx }
        : { x: 0, y: 0 };

      return { item, disabled, hasIcon, iconSize, hasText, textSize, textLayout };
    });
  }, [items, fontSizePx, fontMetrics, iconMode, maxTextLines, fixedColumnWidth, iconScale, props.fixedIconSize, props.textOverrunBehavior, solveNode]);

  const itemSizes = useMemo(
    () =>
      rows.map((r) =>
        itemMinimumSize(
          {
            hasIcon: r.hasIcon,
            iconSize: r.iconSize,
            hasText: r.hasText,
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

  const maxColumnWidth = itemSizes.reduce((max, s) => Math.max(max, s.x), 0);
  const contentWidth = rect.w - panelMargin.x;

  const packed = useMemo(
    () =>
      packItemListRows({
        itemSizes,
        maxColumnWidth,
        sameColumnWidth: props.sameColumnWidth === true,
        maxColumns: props.maxColumns ?? ITEM_LIST_DEFAULT_MAX_COLUMNS,
        fitSize: contentWidth,
        wraparoundItems: props.wraparoundItems !== false,
        autoWidth: props.autoWidth === true,
        hSeparation,
        availableHeight: Math.max(0, rect.h - panelMargin.y),
      }),
    [itemSizes, maxColumnWidth, props.sameColumnWidth, props.maxColumns, contentWidth, rect.h, panelMargin.y, props.wraparoundItems, props.autoWidth, hSeparation]
  );

  const guideLines = useMemo(
    () => itemListGuideLines(iconMode, packed.separators, contentWidth),
    [iconMode, packed.separators, contentWidth]
  );
  const guideColorSrgb = useMemo(() => tintColor(itemListGuideColor(solveNode), tint.own), [solveNode, tint.own]);
  const guideColorLinear = useGodotLinearColor(guideColorSrgb);

  const rowGeometries: RowGeometry[] = useMemo(
    () =>
      rows.map((r, index) => {
        const packedRect = packed.items[index]!.rect;
        const naturalSize = solveNode.textureSlots[itemListIconSlotKey(index)] ?? null;
        const iconDraw = itemIconDraw(
          r.hasIcon,
          iconMode,
          r.iconSize,
          naturalSize,
          fixedIconSizeSet,
          packedRect,
          hSeparation,
          vSeparation,
          iconMargin
        );
        const textOffset = itemTextDrawOffset(
          iconMode,
          iconDraw.textOffsetContribution,
          packedRect,
          r.textLayout?.heightPx ?? 0,
          hSeparation,
          vSeparation
        );
        const centerWidth = packedRect.w - textOffset.x * 2;
        return {
          item: r.item,
          disabled: r.disabled,
          hasIcon: r.hasIcon,
          iconNaturalSize: naturalSize,
          fixedIconSizeSet,
          iconDraw,
          textLayout: r.textLayout,
          textOffset,
          centerWidth,
          iconMode,
          rect: packedRect,
          textColor: itemTextColor(baseFontColor, r.disabled),
        };
      }),
    [rows, packed, iconMode, fixedIconSizeSet, hSeparation, vSeparation, iconMargin, solveNode, baseFontColor]
  );

  // `base_ofs = theme_cache.panel_style->get_offset()` (`item_list.cpp:1429`)
  // — `StyleBox::get_offset()` is `Point2(get_margin(LEFT), get_margin(TOP))`
  // (`style_box.cpp:87-89`), never `contentMarginSize`'s SUMMED pair.
  const origin: Vec2 = { x: panelBox.contentMargin.left, y: panelBox.contentMargin.top };

  return (
    <>
      <StyleBoxQuad styleBox={panelBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      {guideLines.map((line, index) => (
        <CanvasItemGroup key={`guide-${index}`} position={[origin.x, -(origin.y + line.y), 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={line.width}
            height={1}
            color={guideColorLinear}
            opacity={guideColorSrgb.a}
          />
        </CanvasItemGroup>
      ))}
      {rowGeometries.map((geometry, index) => (
        <ItemListRow
          key={index}
          geometry={geometry}
          origin={origin}
          tint={tint.own}
          renderOrder={renderOrder}
          clippingPlanes={clippingPlanes}
          fontSizePx={fontSizePx}
          resources={solveNode.resources}
        />
      ))}
    </>
  );
}
