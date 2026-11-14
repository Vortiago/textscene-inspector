/**
 * `<TabContainer>`: the native (WebGL canvas) painter for `TabContainer::_notification(NOTIFICATION_DRAW)`
 * (`tab_container.cpp:247` to `:277`). It draws `panel` behind the content band and `tabbar_background`
 * across the full-width header band (`:262`, empty by default). The internal TabBar draws the strip
 * (`internalControls.ts`). No popup menu (`get_popup()`) is modelled.
 */

import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { PanelChrome } from '../../../../r3f/controls/native/PanelChrome';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { TabContainerProperties } from './types';
import { TABS_POSITION_TOP, tabContentBand, tabHeaderBand } from './tabLayout';
import { tabHeaderHeightChannel } from './nativeSolver';

export function TabContainer({ solveNode, tint, rect, renderOrder, meta }: NativeControlComponentProps) {
  const props = painterView<TabContainerProperties>(solveNode);
  const tabsPosition = props.tabsPosition ?? TABS_POSITION_TOP;
  // Absent only for a pair the solve did not see, which draws no header.
  const headerHeight = tabHeaderHeightChannel.open(meta) ?? 0;
  const contentBand = tabContentBand(rect, headerHeight, tabsPosition);
  const headerBand = tabHeaderBand(rect, headerHeight, tabsPosition);
  const tabbarBackground = requiredThemeItem(solveNode.styleBoxes, 'tabbar_background');

  return (
    <>
      {/* `<StyleBoxQuad>` sizes off the rect and is POSITIONED by its group. */}
      <CanvasItemGroup position={[contentBand.x, -contentBand.y, 0]}>
        <PanelChrome
          solveNode={solveNode}
          rect={{ x: 0, y: 0, w: contentBand.w, h: contentBand.h }}
          tint={tint}
          renderOrder={renderOrder}
        />
      </CanvasItemGroup>
      {headerHeight > 0 && (
        <CanvasItemGroup position={[headerBand.x, -headerBand.y, 0]}>
          <StyleBoxQuad
            styleBox={tabbarBackground}
            color={tint.own}
            rect={{ x: 0, y: 0, w: headerBand.w, h: headerBand.h }}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
