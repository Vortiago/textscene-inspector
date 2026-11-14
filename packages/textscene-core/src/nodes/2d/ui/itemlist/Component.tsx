/**
 * `<ItemList>`, the native (WebGL canvas) painter for `NOTIFICATION_DRAW`
 * (`scene/gui/item_list.cpp:1367-1729`): the panel, the guide lines, each row's icon and label, the
 * scroll hint, then the scrollbars, as `itemListDraw` places them at the painted rect.
 * `ControlCanvasWalker` owns `visible`, `children` and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useNodeReference } from '../../../../resources/reading';
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
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  OutlinedTextRun,
  TextOutlineRing,
  useTintedTextOutline,
} from '../../../../r3f/controls/native/text/OutlinedTextRun';
import type { TextOutlineTheme } from '../../../../r3f/controls/native/textTheme';
import type { SceneScope } from '../../../../parser/types';
import { itemListDraw, type ItemListDrawnRow } from './itemListDraw';
import { ScrollBarChrome, ScrollHintChrome, SCROLL_HINT_MODULATE } from '../shared/ScrollChrome';
import type { ItemListRuntimeProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';

interface ItemListRowProps {
  geometry: ItemListDrawnRow;
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
    iconColor,
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

  const { texture: iconSource } = useTexture2D(useNodeReference(item.icon, resources));
  const ownIconTexture = useOwnerCanvas2DTexture(iconSource);
  const themedTexture = useNodeIcon(
    item.themedIcon && icons[item.themedIcon.name],
    item.themedIcon?.vendoredUrl ?? null
  );
  const iconTexture = item.themedIcon ? themedTexture : ownIconTexture;
  // Inside the list's own `ControlClipProvider`, so a row clips to the list rect.
  const clippingPlanes = useControlClipPlanes();

  const iconColorSrgb = useMemo(() => tintColor(iconColor, tint), [iconColor, tint]);
  const iconColorLinear = useItemLinearColor(iconColorSrgb);
  const tintedTextColor = useMemo(() => tintColor(textColor, tint), [textColor, tint]);
  const run = { fontSizePx, outline, clippingPlanes, renderOrder };

  return (
    <CanvasItemGroup position={[origin.x + rect.x, -(origin.y + rect.y), 0]}>
      {selectedRect && (
        <StyleBoxQuad styleBox={selectedBox} color={tint} rect={selectedRect} renderOrder={renderOrder} />
      )}
      {iconDraw.rect && iconTexture && (
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
  childTint,
  rect,
  renderOrder,
  slot,
  snapToPixels,
  theme,
  children,
}: NativeControlComponentProps) {
  const props = painterView<ItemListRuntimeProperties>(solveNode);
  const {
    origin,
    guideLines,
    rows: visibleRows,
    scrollBars,
    scrollBarBoxes,
    fontSizePx,
    boxes,
    guideColor,
  } = itemListDraw(solveNode, { x: rect.w, y: rect.h }, theme);

  // `set_clip_contents(true)` (`item_list.cpp:2482`) clips to the list rect, scrollbars aside.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clip } = useWorldClipPlanes(ownRect);
  const clipsContents = props.clipContents !== false;
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  // Both scroll bars and the hint are child Controls: no `self_modulate` (`item_list.cpp:2472,2476`).
  const hintColor = useMemo(() => childTint.color.clone().multiply(SCROLL_HINT_MODULATE), [childTint.color]);
  const guideColorSrgb = useMemo(() => tintColor(guideColor, tint.own), [guideColor, tint.own]);
  const guideColorLinear = useItemLinearColor(guideColorSrgb);

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
          selectedBox={boxes.selected}
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
                styleBox={boxes.cursor}
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
        opacity={childTint.opacity}
        chromeSlot={slot}
      />
      <ScrollBarChrome
        bar={scrollBars.horizontal}
        boxes={scrollBarBoxes.horizontal}
        color={childTint.own}
        chromeSlot={slot}
        snapToPixels={snapToPixels}
      />
      <ScrollBarChrome
        bar={scrollBars.vertical}
        boxes={scrollBarBoxes.vertical}
        color={childTint.own}
        chromeSlot={slot}
        snapToPixels={snapToPixels}
      />
      {children}
    </>
  );

  return (
    <CanvasItemGroup ref={anchorRef}>
      <StyleBoxQuad styleBox={boxes.panel} color={tint.own} rect={rect} renderOrder={renderOrder} />
      {clipsContents ? (
        <ControlClipProvider value={clip}>{rowsAndChildren}</ControlClipProvider>
      ) : (
        rowsAndChildren
      )}
    </CanvasItemGroup>
  );
}
