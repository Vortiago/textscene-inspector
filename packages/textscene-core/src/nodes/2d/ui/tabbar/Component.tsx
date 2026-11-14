/**
 * `<TabBar>`: the native painter for `TabBar::_notification(NOTIFICATION_DRAW)` (`tab_bar.cpp:511-597`),
 * drawing each tab's StyleBox, icon, title and close icon, and the scroll arrows on overflow. The
 * current tab draws last at the same `renderOrder`, so it overlaps its neighbours as in the
 * source's two-pass draw.
 */
import { useMemo } from 'react';
import type { Plane } from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { useIconModulate, useIconRefTexture } from '../../../../r3f/controls/native/useButtonIcon';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { FlippableStyleBox } from '../../../../r3f/controls/native/FlippableStyleBox';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { TEXT_LINE_DEFAULT_OVERRUN, trimSoloLine } from '../../../../r3f/controls/native/text/textOverrun';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { tabBarModel, type ComputedTab } from './tabBarModel';
import { tabBarLoadedOffset } from './loadedOffset';
import { TAB_BAR_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import {
  computeTabBarDrawLayout,
  isCloseButtonVisible,
  layoutScrollArrows,
  layoutTabContent,
  pickTabStyleBox,
  tabBarFontColor,
  tabBarIconColor,
  tabDrawX,
  type TabLayoutItem,
} from './nativeSolver';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';

/**
 * No pointer exists, so `tab_hovered`, `tab_focus`, the close and right buttons' hover background
 * and the drag drop-mark never draw (`buttonBase.ts`). `right_button` is dead code (`nativeSolver.ts`).
 */
export function TabBar({ solveNode, tint, rect, renderOrder, theme, meta }: NativeControlComponentProps) {
  // Unset, the bar scrolls to the current tab once, as a TabBar of the scene does on load.
  const offset = tabBarLoadedOffset.open(meta);
  const {
    computed,
    drawInputs,
    layoutInput,
    closeDisplayPolicy,
    hSeparation,
    closeButtonMargin,
    closeIconSize,
    incrementIconSize,
    decrementIconSize,
    fontSizePx,
    fontMetrics,
    isStyleFlipped,
  } = tabBarModel(solveNode, theme);
  const { currentTab } = layoutInput;
  const drawLayout = useMemo(
    () => computeTabBarDrawLayout(drawInputs, { ...layoutInput, barWidthPx: rect.w, offset }),
    [drawInputs, layoutInput, rect.w, offset]
  );

  const closeIconTexture = useNodeIcon(solveNode.icons.close, TAB_BAR_ICONS.close);
  const incrementIconTexture = useNodeIcon(solveNode.icons.increment, TAB_BAR_ICONS.incrementScroll);
  const decrementIconTexture = useNodeIcon(solveNode.icons.decrement, TAB_BAR_ICONS.decrementScroll);
  const clippingPlanes = useControlClipPlanes();

  const unselectedItems = drawLayout.items.filter((it) => it.index !== currentTab);
  const currentItem = drawLayout.items.find((it) => it.index === currentTab) ?? null;

  const commonChromeProps = {
    currentTab,
    solveNode,
    tint,
    renderOrder,
    barHeight: rect.h,
    barWidth: rect.w,
    rtl: solveNode.rtl,
    hSeparation,
    closeButtonMargin,
    closeIconTexture,
    closeIconSize,
    fontSizePx,
    fontMetrics,
    clippingPlanes,
    isStyleFlipped,
  };

  return (
    <>
      {unselectedItems.map((item) => (
        <TabBarTabChrome
          key={item.index}
          item={item}
          entry={computed[item.index]!}
          closeDisplayPolicy={closeDisplayPolicy}
          {...commonChromeProps}
        />
      ))}
      {currentItem && (
        <TabBarTabChrome
          item={currentItem}
          entry={computed[currentItem.index]!}
          closeDisplayPolicy={closeDisplayPolicy}
          {...commonChromeProps}
        />
      )}
      {drawLayout.buttonsVisible && (
        <ScrollArrows
          rect={rect}
          rtl={solveNode.rtl}
          missingRight={drawLayout.missingRight}
          canScrollBack={drawLayout.offset > 0}
          incrementIconTexture={incrementIconTexture}
          decrementIconTexture={decrementIconTexture}
          incrementIconSize={incrementIconSize}
          decrementIconSize={decrementIconSize}
          tint={tint}
          renderOrder={renderOrder}
        />
      )}
    </>
  );
}

interface TabBarTabChromeProps {
  item: TabLayoutItem;
  entry: ComputedTab;
  currentTab: number;
  solveNode: SolveNode;
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
  barHeight: number;
  barWidth: number;
  rtl: boolean;
  hSeparation: number;
  closeButtonMargin: { left: number; top: number; right: number; bottom: number };
  closeIconTexture: ReturnType<typeof useNodeIcon>;
  closeIconSize: { x: number; y: number };
  fontSizePx: number;
  fontMetrics: FontMetrics | undefined;
  clippingPlanes: readonly Plane[];
  closeDisplayPolicy: number;
  isStyleFlipped: boolean;
}

/** One tab's own chrome: its StyleBox, icon, title, and close icon. A dedicated component so its icon's texture hook is safe across a variable-length tab list (one hook per mounted instance, not a loop of hook calls). */
function TabBarTabChrome({
  item,
  entry,
  currentTab,
  solveNode,
  tint,
  renderOrder,
  barHeight,
  barWidth,
  rtl,
  hSeparation,
  closeButtonMargin,
  closeIconTexture,
  closeIconSize,
  fontSizePx,
  fontMetrics,
  clippingPlanes,
  closeDisplayPolicy,
  isStyleFlipped,
}: TabBarTabChromeProps) {
  const { tab, state, iconSize } = entry;
  const layout = useMemo(
    () =>
      item.truncated && fontMetrics
        ? trimSoloLine(entry.layout, TEXT_LINE_DEFAULT_OVERRUN, item.textBudgetPx, {
            fontMetrics,
            fontSizePx,
            isDrawnRtl: rtl,
          })
        : entry.layout,
    [item.truncated, item.textBudgetPx, entry.layout, fontMetrics, fontSizePx, rtl]
  );
  const style = pickTabStyleBox(solveNode.styleBoxes, state);
  const closeVisible = isCloseButtonVisible(closeDisplayPolicy, item.index, currentTab);

  const iconTexture = useIconRefTexture(solveNode, tab.icon);

  const fontColor = tabBarFontColor(solveNode.colors, state);
  // `tint`, `self_modulate` folded onto `modulate`, composes into every colour before its
  // sRGB-to-linear conversion, as in `PanelChrome.tsx`.
  const tintedFontColor = tintColor(fontColor, tint.own);
  const iconModulate = useIconModulate(tabBarIconColor(solveNode.colors, state), tint.own);
  const closeLinearColor = useItemLinearColor(tint.own);

  const content = layoutTabContent({
    barHeightPx: barHeight,
    style,
    tabWidthPx: item.width,
    rtl,
    iconSize,
    hasText: tab.title.length > 0,
    textNaturalHeightPx: layout.heightPx,
    textAdvanceWidthPx: item.textBudgetPx,
    hSeparation,
    closeVisible,
    closeIconSize,
    buttonHlMargin: closeButtonMargin,
  });

  return (
    <CanvasItemGroup position={[tabDrawX(item.ofs, item.width, barWidth, rtl), 0, 0]}>
      <FlippableStyleBox
        box={style}
        isFlipped={isStyleFlipped}
        tint={tint}
        rect={{ x: 0, y: 0, w: item.width, h: barHeight }}
        renderOrder={renderOrder}
      />
      {content.icon && iconTexture && (
        <PositionedIcon
          rect={content.icon.rect}
          texture={iconTexture}
          color={iconModulate.color}
          opacity={iconModulate.opacity}
          renderOrder={renderOrder}
          canvasKey={renderOrder}
        />
      )}
      {tab.title.length > 0 && content.text && (
        <CanvasItemGroup position={[content.text.offset.x, -content.text.offset.y, 0]}>
          <TextRun
            layout={layout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {content.close && (
        <PositionedIcon
          rect={{
            x: content.close.iconOffset.x,
            y: content.close.iconOffset.y,
            w: closeIconSize.x,
            h: closeIconSize.y,
          }}
          texture={closeIconTexture}
          color={closeLinearColor}
          opacity={tint.own.a}
          renderOrder={renderOrder}
          canvasKey={renderOrder}
        />
      )}
    </CanvasItemGroup>
  );
}

interface ScrollArrowsProps {
  rect: NativeControlComponentProps['rect'];
  rtl: boolean;
  missingRight: boolean;
  canScrollBack: boolean;
  incrementIconTexture: ReturnType<typeof useNodeIcon>;
  decrementIconTexture: ReturnType<typeof useNodeIcon>;
  incrementIconSize: { x: number; y: number };
  decrementIconSize: { x: number; y: number };
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

/** `tab_bar.cpp:564-592` through `layoutScrollArrows`: which edge the pair sits against, and which arrow `offset > 0` and `missing_right` light, both follow the layout direction. */
function ScrollArrows({
  rect,
  rtl,
  missingRight,
  canScrollBack,
  incrementIconTexture,
  decrementIconTexture,
  incrementIconSize,
  decrementIconSize,
  tint,
  renderOrder,
}: ScrollArrowsProps) {
  const arrows = layoutScrollArrows({
    barWidthPx: rect.w,
    barHeightPx: rect.h,
    incrementIconSize,
    decrementIconSize,
    missingRight,
    canScrollBack,
    rtl,
  });
  // Drawn white, then modulated with the bar's tint as every item it draws.
  const arrowColor = useItemLinearColor(tint.own);
  const alpha = (dim: boolean) => (dim ? 0.5 : 1) * tint.own.a;

  return (
    <>
      <PositionedIcon
        rect={{
          x: arrows.decrement.x,
          y: arrows.decrement.y,
          w: decrementIconSize.x,
          h: decrementIconSize.y,
        }}
        texture={decrementIconTexture}
        color={arrowColor}
        opacity={alpha(arrows.decrement.dim)}
        renderOrder={renderOrder}
        canvasKey={renderOrder}
      />
      <PositionedIcon
        rect={{
          x: arrows.increment.x,
          y: arrows.increment.y,
          w: incrementIconSize.x,
          h: incrementIconSize.y,
        }}
        texture={incrementIconTexture}
        color={arrowColor}
        opacity={alpha(arrows.increment.dim)}
        renderOrder={renderOrder}
        canvasKey={renderOrder}
      />
    </>
  );
}
