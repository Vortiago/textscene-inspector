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
import { TAB_ALIGNMENT_LEFT, reconstructThemeScale, tabBarMinimumSize } from '../tabbar/nativeSolver';
import { TabBar } from '../tabbar/Component';
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

/** `default_theme.cpp:1223`: `theme->set_constant("side_margin", "TabContainer", round(8 * scale))`, the literal `nativeSolver.ts` uses for the minimum size. */
const SIDE_MARGIN_LITERAL = 8;

const EMPTY_CHILD_RECTS: NativeControlComponentProps['childRects'] = new Map();

export function TabContainer({
  solveNode,
  tint,
  rect,
  theme,
  renderOrder,
  subtreeChromeRenderOrder,
  measureText,
  snapToPixels,
  effectiveZ,
}: NativeControlComponentProps) {
  const props = painterView<TabContainerProperties>(solveNode);
  const tabsVisible = props.tabsVisible ?? true;
  const tabsPosition = props.tabsPosition ?? TABS_POSITION_TOP;
  const alignment = props.tabAlignment ?? TAB_ALIGNMENT_LEFT;
  const allTabsInFront = props.allTabsInFront ?? false;

  const derivedTabs = useMemo(() => deriveTabContainerTabs(solveNode, props.tabOverrides), [solveNode, props.tabOverrides]);
  const syntheticBar = useMemo(
    () => buildInternalTabBarNode(solveNode, derivedTabs, props, theme),
    [solveNode, derivedTabs, props, theme]
  );

  const barCtx: Pick<SolveContext, 'theme' | 'measureText'> = { theme, measureText };
  const barMinHeight = tabBarMinimumSize(syntheticBar, barCtx as SolveContext).y;

  const tabbarMargin = tabbarStyleMargins(solveNode.styleBoxes);
  const showsStrip = tabsVisible && derivedTabs.length > 0;
  const headerHeight = showsStrip ? tabHeaderHeight(barMinHeight, tabbarMargin) : 0;

  const sideMargin = Math.round(SIDE_MARGIN_LITERAL * reconstructThemeScale(theme));
  const barRect = showsStrip
    ? tabBarRect(rect, barMinHeight, tabsPosition, alignment, sideMargin, tabbarMargin, solveNode.rtl)
    : null;
  const contentBand = tabContentBand(rect, headerHeight, tabsPosition);

  const tabbarBackground = solveNode.styleBoxes.tabbar_background;
  const headerBand = tabHeaderBand(rect, headerHeight, tabsPosition);

  // Godot's default (`all_tabs_in_front === false`, `INTERNAL_MODE_BACK`) draws the strip
  // after every page, on top. This painter draws before its children, which is the `true`
  // case (`INTERNAL_MODE_FRONT`), so the default takes the subtree-chrome slot.
  const stripRenderOrder = allTabsInFront ? renderOrder : subtreeChromeRenderOrder + 0.5;

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
        <CanvasItemGroup position={[barRect.x, -barRect.y, 0]}>
          <TabBar
            solveNode={syntheticBar}
            tint={tint}
            rect={{ x: 0, y: 0, w: barRect.w, h: barRect.h }}
            theme={theme}
            renderOrder={stripRenderOrder}
            subtreeChromeRenderOrder={stripRenderOrder}
            effectiveZ={effectiveZ}
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
