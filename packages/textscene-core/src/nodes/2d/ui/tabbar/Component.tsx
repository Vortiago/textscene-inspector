/**
 * `<TabBar>`: the native painter for `TabBar::_notification(NOTIFICATION_DRAW)` (`tab_bar.cpp:511-597`),
 * drawing each tab's StyleBox, icon, title and close icon, and the scroll arrows on overflow. The
 * current tab draws last at the same `renderOrder`, so it overlaps its neighbours as in the
 * source's two-pass draw.
 */
import { useMemo } from 'react';
import type { Plane } from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { useIconModulate, useIconRefTexture } from '../../../../r3f/controls/native/useButtonIcon';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { TEXT_LINE_DEFAULT_OVERRUN, trimSoloLine } from '../../../../r3f/controls/native/text/textOverrun';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import type { TabBarProperties, TabBarTabProperties } from './types';
import { TAB_BAR_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import {
  TAB_ALIGNMENT_LEFT,
  TAB_BAR_THEME_FONT_KEY,
  computeTabBarDrawLayout,
  fitTabIconSize,
  isCloseButtonVisible,
  layoutScrollArrows,
  layoutTabContent,
  pickTabStyleBox,
  resolveTabDrawState,
  isTabUnselectable,
  resolveTabBarCurrentTab,
  shapeTabLabel,
  tabBarFontColor,
  tabBarFontSizePx,
  tabBarIconColor,
  tabBarThemeIconSize,
  tabContentWidth,
  tabDrawX,
  tabIconNaturalSize,
  tabWidthStyleMinWidth,
  type TabDrawState,
  type TabLayoutInput,
  type TabLayoutItem,
} from './nativeSolver';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';

/** A stable identity for "no tabs", so a Control with none never invalidates a memo depending on it every render. */
const EMPTY_TABS: readonly TabBarTabProperties[] = [];

interface ComputedTab {
  tab: TabBarTabProperties;
  state: TabDrawState;
  iconSize: { x: number; y: number } | null;
  layout: TextLayoutResult;
}

/** Everything about a TabBar's tabs that does not depend on its width: the TabContainer reads it to size the bar before it draws. */
export function useTabBarModel(solveNode: SolveNode, theme: NativeControlComponentProps['theme']) {
  const props = painterView<TabBarProperties>(solveNode);
  const tabs = props.tabs ?? EMPTY_TABS;
  const currentTab = resolveTabBarCurrentTab(props.currentTab, props.deselectEnabled, tabs.length, (i) =>
    isTabUnselectable(tabs[i]!)
  );
  const alignment = props.tabAlignment ?? TAB_ALIGNMENT_LEFT;
  const clipTabs = props.clipTabs ?? true;
  const maxTabWidth = props.maxTabWidth ?? 0;
  const scrollToSelected = props.scrollToSelected ?? true;
  const closeDisplayPolicy = props.tabCloseDisplayPolicy ?? 0;
  const hSeparation = requiredThemeItem(solveNode.constants, 'h_separation');
  const tabSeparation = solveNode.constants.tab_separation ?? 0;
  const iconMaxWidth = requiredThemeItem(solveNode.constants, 'icon_max_width');

  const styleBoxes = solveNode.styleBoxes;
  const closeButtonMargin = theme.widgets.button.normal.contentMargin;
  const closeIconSize = tabBarThemeIconSize(solveNode, 'close', theme.scale);
  const incrementIconSize = tabBarThemeIconSize(solveNode, 'increment', theme.scale);
  const decrementIconSize = tabBarThemeIconSize(solveNode, 'decrement', theme.scale);

  const fontMetrics = resolveNodeFontMetrics(solveNode, TAB_BAR_THEME_FONT_KEY);
  // Shaped here rather than carried over from the solver, so the internal bar
  // a TabContainer paints (never in the solve tree) takes the same arm.
  const fontSizePx = tabBarFontSizePx(solveNode, props, theme);

  const computed: ComputedTab[] = useMemo(
    () =>
      tabs.map((tab, i) => {
        const state = resolveTabDrawState(tab, i, currentTab);
        const iconNatural = tabIconNaturalSize(solveNode, i);
        const iconSize = iconNatural ? fitTabIconSize(iconNatural, iconMaxWidth) : null;
        const layout = shapeTabLabel(tab.title, solveNode, { fontSizePx, fontMetrics });
        return { tab, state, iconSize, layout };
      }),
    [tabs, currentTab, iconMaxWidth, fontSizePx, fontMetrics, solveNode]
  );

  // Under `SolveNode.rtl` each tab mirrors in the bar and its content flows from the trailing
  // edge (`nativeSolver.ts`'s `tabDrawX`/`layoutTabContent`).
  const drawInputs: TabLayoutInput[] = useMemo(
    () =>
      computed.map(({ tab, state, iconSize, layout }, i) => {
        const styleMinWidth = tabWidthStyleMinWidth(styleBoxes, state);
        const naturalTextWidth = shapedTextSizeWidthPx(layout.widthPx);
        const closeVisible = isCloseButtonVisible(closeDisplayPolicy, i, currentTab);
        const naturalWidth = tabContentWidth({
          styleMinWidth,
          iconWidth: iconSize ? iconSize.x : null,
          hSeparation,
          textWidthPx: naturalTextWidth,
          hasText: tab.title.length > 0,
          closeVisible,
          closeIconWidth: closeIconSize.x,
          closeButtonMarginLeft: closeButtonMargin.left,
        });
        return { disabled: tab.disabled, hidden: tab.hidden === true, naturalWidth, naturalTextWidth };
      }),
    [
      computed,
      styleBoxes,
      hSeparation,
      closeDisplayPolicy,
      currentTab,
      closeButtonMargin.left,
      closeIconSize.x,
    ]
  );

  const layoutInput = useMemo(
    () => ({
      alignment,
      clipTabs,
      maxTabWidthPx: maxTabWidth,
      tabSeparation,
      incrementIconWidth: incrementIconSize.x,
      decrementIconWidth: decrementIconSize.x,
      currentTab,
      scrollToSelected,
    }),
    [
      alignment,
      clipTabs,
      maxTabWidth,
      tabSeparation,
      incrementIconSize.x,
      decrementIconSize.x,
      currentTab,
      scrollToSelected,
    ]
  );

  return {
    computed,
    drawInputs,
    layoutInput,
    currentTab,
    closeDisplayPolicy,
    hSeparation,
    styleBoxes,
    closeButtonMargin,
    closeIconSize,
    incrementIconSize,
    decrementIconSize,
    fontSizePx,
    fontMetrics,
  };
}

export type TabBarModel = ReturnType<typeof useTabBarModel>;

/**
 * No pointer exists, so `tab_hovered`, `tab_focus`, the close and right buttons' hover background
 * and the drag drop-mark never draw (`buttonBase.ts`). `right_button` is dead code (`nativeSolver.ts`),
 * and only TabContainer consumes `all_tabs_in_front`'s front ordering.
 */
export function TabBar(props: NativeControlComponentProps) {
  const model = useTabBarModel(props.solveNode, props.theme);
  return <TabBarStrip {...props} model={model} />;
}

interface TabBarStripProps extends Omit<NativeControlComponentProps, 'childTint'> {
  model: TabBarModel;
  /** The first drawn tab, when the caller resolved it. Unset, the strip scrolls to the current tab once. */
  offset?: number;
}

/** The painter for one resolved width: it draws `model` in `rect`. */
export function TabBarStrip({ solveNode, tint, rect, renderOrder, model, offset }: TabBarStripProps) {
  const {
    computed,
    drawInputs,
    layoutInput,
    currentTab,
    closeDisplayPolicy,
    hSeparation,
    styleBoxes,
    closeButtonMargin,
    closeIconSize,
    incrementIconSize,
    decrementIconSize,
    fontSizePx,
    fontMetrics,
  } = model;
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
    styleBoxes,
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
  styleBoxes: Readonly<Record<string, StyleBoxFlatData>>;
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
}

/** One tab's own chrome: its StyleBox, icon, title, and close icon. A dedicated component so its icon's texture hook is safe across a variable-length tab list (one hook per mounted instance, not a loop of hook calls). */
function TabBarTabChrome({
  item,
  entry,
  currentTab,
  solveNode,
  styleBoxes,
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
  const style = pickTabStyleBox(styleBoxes, state);
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
      <StyleBoxQuad
        styleBox={style}
        color={tint.own}
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
  const white = useItemLinearColor({ r: 1, g: 1, b: 1 });
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
        color={white}
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
        color={white}
        opacity={alpha(arrows.increment.dim)}
        renderOrder={renderOrder}
        canvasKey={renderOrder}
      />
    </>
  );
}
