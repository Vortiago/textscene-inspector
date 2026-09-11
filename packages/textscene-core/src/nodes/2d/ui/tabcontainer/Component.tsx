/**
 * `<TabContainer>` — the native (WebGL canvas) painter for `TabContainer`:
 * `TabContainer::_notification(NOTIFICATION_DRAW)` (`tab_container.cpp:247-
 * 277`). Draws the `panel` StyleBox behind the content band, the
 * `tabbar_background` StyleBox behind the strip (an EMPTY box by default —
 * draws nothing unless overridden), and the internal tab strip itself,
 * delegating entirely to `../tabbar/Component.tsx`'s own `<TabBar>` against
 * a synthetic `SolveNode` (`nativeSolver.ts`'s `buildInternalTabBarNode`) —
 * one strip-drawing implementation, not a second copy that could drift.
 *
 * `all_tabs_in_front` decides whether the strip draws BEHIND its pages
 * (`false`, the class default — Godot's own `INTERNAL_MODE_BACK`, which
 * places a child AFTER every regular child, i.e. ON TOP — so the DEFAULT
 * actually draws the strip OVER the current page) or in front of them
 * (`true` — `INTERNAL_MODE_FRONT`, drawn first, UNDER the page). The walker
 * renders this painter's own output BEFORE its children (siblings drawn
 * after), which is already the `true` case; the DEFAULT needs
 * `subtreeChromeRenderOrder` instead (`ControlComponentRegistry.ts`'s own
 * doc on that field).
 *
 * No `Popup`/context-menu is modelled (`get_popup()`), so the popup menu
 * icon this painter's Godot counterpart draws beside the strip never
 * appears — there is nothing for it to open.
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
} from './nativeSolver';

/** `default_theme.cpp:1223`: `theme->set_constant("side_margin", "TabContainer", round(8 * scale))` — same literal `nativeSolver.ts`'s own `SIDE_MARGIN_LITERAL` uses for the minimum-size contribution. */
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
  const barResult = tabBarMinimumSize(syntheticBar, barCtx as SolveContext);
  const headerHeight = tabsVisible ? ('size' in barResult ? barResult.size.y : barResult.y) : 0;

  const sideMargin = Math.round(SIDE_MARGIN_LITERAL * reconstructThemeScale(theme));
  const barRect = tabsVisible ? tabBarRect(rect, headerHeight, tabsPosition, alignment, sideMargin) : null;
  const contentBand = tabContentBand(rect, headerHeight, tabsPosition);

  const tabbarBackground = solveNode.styleBoxes.tabbar_background;

  // Godot's DEFAULT (`all_tabs_in_front === false`) draws the strip AFTER
  // every page (`INTERNAL_MODE_BACK`) — this painter's own output otherwise
  // draws BEFORE its children, so the default case needs the subtree-chrome
  // slot instead of this node's own paint slot.
  const stripRenderOrder = allTabsInFront ? renderOrder : subtreeChromeRenderOrder + 0.5;

  return (
    <>
      <PanelChrome solveNode={solveNode} rect={contentBand} theme={theme} tint={tint} renderOrder={renderOrder} />
      {tabbarBackground && barRect && (
        <StyleBoxQuad styleBox={tabbarBackground} color={tint.own} rect={barRect} renderOrder={renderOrder} />
      )}
      {tabsVisible && barRect && (
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
