/**
 * `<TabBar>` — the native (WebGL canvas) painter for `TabBar`:
 * `TabBar::_notification(NOTIFICATION_DRAW)` (`tab_bar.cpp:511-597`). Draws
 * every tab's own StyleBox (unselected tabs first, the current tab last, so
 * it overlaps its neighbours exactly like the source's two-pass draw — same
 * `renderOrder`, submission order settles it), its icon and title, the close
 * icon where `tab_close_display_policy` calls for it, and the scroll arrows
 * when the tabs overflow `clip_tabs`'s bar width.
 *
 * Under `is_layout_rtl()` (`SolveNode.rtl`) every tab is mirrored inside the
 * bar and its own icon/title/close flow back from the trailing edge
 * (`nativeSolver.ts`'s `tabDrawX`/`layoutTabContent`), and the scroll arrows
 * move to the opposite edge.
 *
 * A static previewer has no pointer: `hover`/`rb_hover`/`cb_hover`/drag state
 * are never modelled (`buttonBase.ts`'s own precedent), so this never draws
 * `tab_hovered`, `tab_focus`, the close/right button's hover background, or
 * the drag drop-mark. `right_button` is dead code here (`nativeSolver.ts`'s
 * own header) and `all_tabs_in_front` is interaction-adjacent — TabContainer
 * is the only consumer of the "front" ordering (see its own painter).
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate` — composed into every colour this painter reads BEFORE
 * that colour's own sRGB→linear conversion, `PanelChrome.tsx`'s established
 * ordering.
 */
import { useMemo } from 'react';
import type { Plane } from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import type { TabBarProperties, TabBarTabProperties } from './types';
import { TAB_BAR_ICONS } from '../../../../r3f/controls/native/themeIcons';
import {
  TAB_ALIGNMENT_LEFT,
  TAB_BAR_THEME_FONT_KEY,
  computeTabBarDrawLayout,
  fitTabIconSize,
  isCloseButtonVisible,
  isTabBarMinimumSizeMeta,
  layoutScrollArrows,
  layoutTabContent,
  pickTabStyleBox,
  reconstructThemeScale,
  resolveTabDrawState,
  shapeTabLabel,
  tabBarIconColor,
  tabBarStyleBoxes,
  tabBarTextTheme,
  tabBarThemeIconSize,
  tabContentWidth,
  tabDrawX,
  tabIconNaturalSize,
  tabWidthStyleMinWidth,
  type TabDrawState,
  type TabLayoutInput,
  type TabLayoutItem,
} from './nativeSolver';

/** A stable identity for "no tabs", so a Control with none never invalidates a memo depending on it every render. */
const EMPTY_TABS: readonly TabBarTabProperties[] = [];

interface ComputedTab {
  tab: TabBarTabProperties;
  state: TabDrawState;
  iconSize: { x: number; y: number } | null;
  layout: TextLayoutResult;
}

export function TabBar({ solveNode, tint, rect, theme, renderOrder, meta }: NativeControlComponentProps) {
  const props = painterView<TabBarProperties>(solveNode);
  const tabs = props.tabs ?? EMPTY_TABS;
  const currentTab = props.currentTab ?? -1;
  const alignment = props.tabAlignment ?? TAB_ALIGNMENT_LEFT;
  const clipTabs = props.clipTabs ?? true;
  const maxTabWidth = props.maxTabWidth ?? 0;
  const closeDisplayPolicy = props.tabCloseDisplayPolicy ?? 0;
  const hSeparation = solveNode.constants.h_separation ?? theme.separation;
  const tabSeparation = solveNode.constants.tab_separation ?? 0;
  const iconMaxWidth = solveNode.constants.icon_max_width ?? 0;

  const scale = reconstructThemeScale(theme);
  const defaults = useMemo(() => tabBarStyleBoxes(scale), [scale]);
  const overrides = solveNode.styleBoxes;
  const closeButtonMargin = theme.widgets.button.normal.contentMargin;
  const closeIconSize = tabBarThemeIconSize(solveNode, 'close');
  const incrementIconSize = tabBarThemeIconSize(solveNode, 'increment');
  const decrementIconSize = tabBarThemeIconSize(solveNode, 'decrement');

  const fontMetrics = resolveNodeFontMetrics(solveNode, TAB_BAR_THEME_FONT_KEY);
  const cachedLayouts = meta && isTabBarMinimumSizeMeta(meta) ? meta.layouts : null;
  const fontSizePx = tabBarTextTheme(solveNode, props, 'unselected', { theme }).fontSizePx;

  const computed: ComputedTab[] = useMemo(
    () =>
      tabs.map((tab, i) => {
        const state = resolveTabDrawState(tab, i, currentTab);
        const iconNatural = tabIconNaturalSize(solveNode, i);
        const iconSize = iconNatural ? fitTabIconSize(iconNatural, iconMaxWidth) : null;
        const cached = cachedLayouts?.[i] ?? null;
        const layout = cached ?? shapeTabLabel(tab.title, fontSizePx, fontMetrics);
        return { tab, state, iconSize, layout };
      }),
    [tabs, currentTab, iconMaxWidth, fontSizePx, fontMetrics, cachedLayouts, solveNode]
  );

  const drawInputs: TabLayoutInput[] = useMemo(
    () =>
      computed.map(({ tab, state, iconSize, layout }, i) => {
        const styleMinWidth = tabWidthStyleMinWidth(overrides, defaults, state);
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
    [computed, overrides, defaults, hSeparation, closeDisplayPolicy, currentTab, closeButtonMargin.left, closeIconSize.x]
  );

  const drawLayout = useMemo(
    () =>
      computeTabBarDrawLayout(
        drawInputs,
        rect.w,
        alignment,
        clipTabs,
        maxTabWidth,
        tabSeparation,
        incrementIconSize.x,
        decrementIconSize.x
      ),
    [drawInputs, rect.w, alignment, clipTabs, maxTabWidth, tabSeparation, incrementIconSize.x, decrementIconSize.x]
  );

  const closeIconTexture = useNodeIcon(solveNode.icons.close, TAB_BAR_ICONS.close);
  const incrementIconTexture = useNodeIcon(solveNode.icons.increment, TAB_BAR_ICONS.incrementScroll);
  const decrementIconTexture = useNodeIcon(solveNode.icons.decrement, TAB_BAR_ICONS.decrementScroll);
  const clippingPlanes = useControlClipPlanes();

  const unselectedItems = drawLayout.items.filter((it) => it.index !== currentTab);
  const currentItem = drawLayout.items.find((it) => it.index === currentTab) ?? null;

  const commonChromeProps = {
    props,
    solveNode,
    overrides,
    defaults,
    theme,
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
    clippingPlanes,
  };

  return (
    <>
      {unselectedItems.map((item) => (
        <TabBarTabChrome key={item.index} item={item} entry={computed[item.index]!} closeDisplayPolicy={closeDisplayPolicy} {...commonChromeProps} />
      ))}
      {currentItem && (
        <TabBarTabChrome item={currentItem} entry={computed[currentItem.index]!} closeDisplayPolicy={closeDisplayPolicy} {...commonChromeProps} />
      )}
      {drawLayout.buttonsVisible && (
        <ScrollArrows
          rect={rect}
          rtl={solveNode.rtl}
          missingRight={drawLayout.missingRight}
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
  props: TabBarProperties;
  solveNode: SolveNode;
  overrides: Readonly<Record<string, StyleBoxFlatData>>;
  defaults: ReturnType<typeof tabBarStyleBoxes>;
  theme: NativeControlComponentProps['theme'];
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
  clippingPlanes: readonly Plane[];
  closeDisplayPolicy: number;
}

/** One tab's own chrome: its StyleBox, icon, title, and close icon. A dedicated component so its icon's `useTexture2D` call is safe across a variable-length tab list (one hook per mounted instance, not a loop of hook calls). */
function TabBarTabChrome({
  item,
  entry,
  props,
  solveNode,
  overrides,
  defaults,
  theme,
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
  clippingPlanes,
  closeDisplayPolicy,
}: TabBarTabChromeProps) {
  const { tab, state, iconSize, layout } = entry;
  const style = pickTabStyleBox(overrides, defaults, state);
  const closeVisible = isCloseButtonVisible(closeDisplayPolicy, item.index, props.currentTab ?? -1);

  const { externalResources, internalResources } = solveNode.resources;
  const { texture: iconSource } = useTexture2D(tab.icon, externalResources, internalResources);
  const iconTexture = useCanvas2DTexture(iconSource);

  const fontColor = tabBarTextTheme(solveNode, props, state, { theme }).color;
  const tintedFontColor = tintColor(fontColor, tint.own);
  const baseIconColor = tabBarIconColor(solveNode.colors, state);
  const tintedIconColor = tintColor(baseIconColor, tint.own);
  const iconLinearColor = useGodotLinearColor(tintedIconColor);
  const closeLinearColor = useGodotLinearColor(tint.own);

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
        <CanvasItemGroup position={[content.icon.rect.x, -content.icon.rect.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={content.icon.rect.w}
            height={content.icon.rect.h}
            color={iconLinearColor}
            opacity={tintedIconColor.a}
            map={iconTexture}
          />
        </CanvasItemGroup>
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
        <CanvasItemGroup position={[content.close.iconOffset.x, -content.close.iconOffset.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={closeIconSize.x}
            height={closeIconSize.y}
            color={closeLinearColor}
            opacity={tint.own.a}
            map={closeIconTexture}
          />
        </CanvasItemGroup>
      )}
    </CanvasItemGroup>
  );
}

interface ScrollArrowsProps {
  rect: NativeControlComponentProps['rect'];
  rtl: boolean;
  missingRight: boolean;
  incrementIconTexture: ReturnType<typeof useNodeIcon>;
  decrementIconTexture: ReturnType<typeof useNodeIcon>;
  incrementIconSize: { x: number; y: number };
  decrementIconSize: { x: number; y: number };
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

/** `tab_bar.cpp:564-592` through `layoutScrollArrows` — which edge the pair sits against, and which of the two `missing_right` lights up, both follow the layout direction. */
function ScrollArrows({
  rect,
  rtl,
  missingRight,
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
    rtl,
  });
  const white = useGodotLinearColor({ r: 1, g: 1, b: 1 });
  const alpha = (dim: boolean) => (dim ? 0.5 : 1) * tint.own.a;

  return (
    <>
      <CanvasItemGroup position={[arrows.decrement.x, -arrows.decrement.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={decrementIconSize.x}
          height={decrementIconSize.y}
          color={white}
          opacity={alpha(arrows.decrement.dim)}
          map={decrementIconTexture}
        />
      </CanvasItemGroup>
      <CanvasItemGroup position={[arrows.increment.x, -arrows.increment.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={incrementIconSize.x}
          height={incrementIconSize.y}
          color={white}
          opacity={alpha(arrows.increment.dim)}
          map={incrementIconTexture}
        />
      </CanvasItemGroup>
    </>
  );
}
