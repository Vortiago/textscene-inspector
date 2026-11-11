/**
 * `<TabContainer>`: the native (WebGL canvas) painter for `TabContainer::_notification(NOTIFICATION_DRAW)`
 * (`tab_container.cpp:247` to `:277`). It draws `panel` behind the content band, `tabbar_background`
 * across the full-width header band (`:262`, empty by default), and the strip through `<TabBar>`
 * on the synthetic node from `buildInternalTabBarNode`. No popup menu (`get_popup()`) is modelled.
 */

import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { PanelChrome } from '../../../../r3f/controls/native/PanelChrome';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { TAB_ALIGNMENT_LEFT, tabBarMinimumSize } from '../tabbar/nativeSolver';
import { TabBarStrip, useTabBarModel } from '../tabbar/Component';
import { resolveTabContainerStrip } from './loadStrip';
import type { TabContainerProperties } from './types';
import {
  TABS_POSITION_TOP,
  buildInternalTabBarNode,
  deriveTabContainerTabs,
  tabBarRect,
  tabContentBand,
  tabHeaderBand,
  tabHeaderHeight,
  tabbarStyleMargins,
} from './nativeSolver';
import { canvasSubOrder } from '../../../../r3f/canvasItemState';

/** `default_theme.cpp:1223`: `theme->set_constant("side_margin", "TabContainer", round(8 * scale))`, the literal `nativeSolver.ts` uses for the minimum size. */
const SIDE_MARGIN_LITERAL = 8;

const EMPTY_CHILD_RECTS: NativeControlComponentProps['childRects'] = new Map();

export function TabContainer({
  solveNode,
  tint,
  rect,
  theme,
  renderOrder,
  slot,
  chromeSlot,
  measureText,
  snapToPixels,
}: NativeControlComponentProps) {
  const props = painterView<TabContainerProperties>(solveNode);
  const tabsVisible = props.tabsVisible ?? true;
  const tabsPosition = props.tabsPosition ?? TABS_POSITION_TOP;
  const alignment = props.tabAlignment ?? TAB_ALIGNMENT_LEFT;
  const allTabsInFront = props.allTabsInFront ?? false;

  const derivedTabs = useMemo(
    () => deriveTabContainerTabs(solveNode, props.tabOverrides),
    [solveNode, props.tabOverrides]
  );
  const syntheticBar = useMemo(
    () => buildInternalTabBarNode(solveNode, derivedTabs, props, theme),
    [solveNode, derivedTabs, props, theme]
  );

  const barCtx: Pick<SolveContext, 'theme' | 'measureText'> = { theme, measureText };
  const barMinHeight = tabBarMinimumSize(syntheticBar, barCtx as SolveContext).y;

  const tabbarMargin = tabbarStyleMargins(solveNode.styleBoxes);
  const showsStrip = tabsVisible && derivedTabs.length > 0;
  const headerHeight = showsStrip ? tabHeaderHeight(barMinHeight, tabbarMargin) : 0;

  const barModel = useTabBarModel(syntheticBar, theme);
  const strip = useMemo(
    () =>
      resolveTabContainerStrip(barModel.drawInputs, barModel.layoutInput, {
        containerWidthPx: rect.w,
        leftMarginPx: solveNode.rtl ? tabbarMargin.right : tabbarMargin.left,
        rightMarginPx: solveNode.rtl ? tabbarMargin.left : tabbarMargin.right,
        sideMarginPx: Math.round(SIDE_MARGIN_LITERAL * theme.scale),
        rtl: solveNode.rtl,
      }),
    [barModel, rect.w, solveNode.rtl, tabbarMargin, theme.scale]
  );
  const barRect = showsStrip
    ? tabBarRect(rect, barMinHeight, tabsPosition, alignment, strip.sideMarginPx, tabbarMargin, solveNode.rtl)
    : null;
  const contentBand = tabContentBand(rect, headerHeight, tabsPosition);

  const tabbarBackground = solveNode.styleBoxes.tabbar_background;
  const headerBand = tabHeaderBand(rect, headerHeight, tabsPosition);

  // Godot's default (`all_tabs_in_front === false`, `INTERNAL_MODE_BACK`) draws the strip
  // after every page, on top, from the chrome slot. With `true` (`INTERNAL_MODE_FRONT`) it draws
  // after the container's own pixels and before the pages, from a piece of its own key.
  const stripSlot = canvasSubOrder(allTabsInFront ? slot : chromeSlot);

  return (
    <>
      {/* `<StyleBoxQuad>` sizes off the rect and is POSITIONED by its group. */}
      <CanvasItemGroup position={[contentBand.x, -contentBand.y, 0]}>
        <PanelChrome
          solveNode={solveNode}
          rect={{ x: 0, y: 0, w: contentBand.w, h: contentBand.h }}
          theme={theme}
          tint={tint}
          renderOrder={renderOrder}
        />
      </CanvasItemGroup>
      {tabbarBackground && headerHeight > 0 && (
        <CanvasItemGroup position={[headerBand.x, -headerBand.y, 0]}>
          <StyleBoxQuad
            styleBox={tabbarBackground}
            color={tint.own}
            rect={{ x: 0, y: 0, w: headerBand.w, h: headerBand.h }}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {barRect && (
        // The strip's own group key: three sorts by the nearest group's order first.
        <CanvasItemGroup position={[barRect.x, -barRect.y, 0]} renderOrder={stripSlot.key}>
          <TabBarStrip
            solveNode={syntheticBar}
            model={barModel}
            offset={strip.offset}
            tint={tint}
            rect={{ x: 0, y: 0, w: barRect.w, h: barRect.h }}
            theme={theme}
            renderOrder={stripSlot.key}
            slot={stripSlot}
            chromeSlot={stripSlot}
            layerSlot={stripSlot}
            measureText={measureText}
            snapToPixels={snapToPixels}
            childRects={EMPTY_CHILD_RECTS}
            meta={undefined}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
