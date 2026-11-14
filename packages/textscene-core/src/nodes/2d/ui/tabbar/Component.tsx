/**
 * `<TabBar>`: the native painter for `TabBar::_notification(NOTIFICATION_DRAW)` (`tab_bar.cpp:511-597`),
 * drawing each tab's StyleBox, icon, title and close icon, and the scroll arrows on overflow. The
 * current tab draws last at the same `renderOrder`, so it overlaps its neighbours as in the
 * source's two-pass draw.
 */
import type { Plane } from 'three';
import type { Vector2 } from '../../../../godot/math/vector';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { useIconModulate, useIconRefTexture } from '../../../../r3f/controls/native/useButtonIcon';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { FlippableStyleBox } from '../../../../r3f/controls/native/FlippableStyleBox';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { TAB_BAR_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';
import { tabBarLoadedOffset } from './loadedOffset';
import type { ScrollArrowsLayout } from './nativeSolver';
import { tabBarLayout, type DrawnTab } from './tabBarLayout';

/**
 * No pointer exists, so `tab_hovered`, `tab_focus`, the close and right buttons' hover background
 * and the drag drop-mark never draw (`buttonBase.ts`). `right_button` is dead code (`nativeSolver.ts`).
 */
export function TabBar({ solveNode, tint, rect, renderOrder, theme, meta }: NativeControlComponentProps) {
  const { model, at } = tabBarLayout(solveNode, { x: rect.w, y: rect.h }, theme);
  const { tabs, arrows } = at(tabBarLoadedOffset.open(meta));

  const closeIconTexture = useNodeIcon(solveNode.icons.close, TAB_BAR_ICONS.close);
  const incrementIconTexture = useNodeIcon(solveNode.icons.increment, TAB_BAR_ICONS.incrementScroll);
  const decrementIconTexture = useNodeIcon(solveNode.icons.decrement, TAB_BAR_ICONS.decrementScroll);
  const clippingPlanes = useControlClipPlanes();

  return (
    <>
      {tabs.map((drawn) => (
        <TabBarTabChrome
          key={drawn.index}
          drawn={drawn}
          solveNode={solveNode}
          tint={tint}
          renderOrder={renderOrder}
          barHeight={rect.h}
          closeIconTexture={closeIconTexture}
          closeIconSize={model.closeIconSize}
          fontSizePx={model.fontSizePx}
          clippingPlanes={clippingPlanes}
          isStyleFlipped={model.isStyleFlipped}
        />
      ))}
      {arrows && (
        <ScrollArrows
          arrows={arrows}
          incrementIconTexture={incrementIconTexture}
          decrementIconTexture={decrementIconTexture}
          incrementIconSize={model.incrementIconSize}
          decrementIconSize={model.decrementIconSize}
          tint={tint}
          renderOrder={renderOrder}
        />
      )}
    </>
  );
}

interface TabBarTabChromeProps {
  drawn: DrawnTab;
  solveNode: SolveNode;
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
  barHeight: number;
  closeIconTexture: ReturnType<typeof useNodeIcon>;
  closeIconSize: Vector2;
  fontSizePx: number;
  clippingPlanes: readonly Plane[];
  isStyleFlipped: boolean;
}

/** One tab's own chrome: its StyleBox, icon, title, and close icon. A dedicated component so its icon's texture hook is safe across a variable-length tab list (one hook per mounted instance, not a loop of hook calls). */
function TabBarTabChrome({
  drawn,
  solveNode,
  tint,
  renderOrder,
  barHeight,
  closeIconTexture,
  closeIconSize,
  fontSizePx,
  clippingPlanes,
  isStyleFlipped,
}: TabBarTabChromeProps) {
  const { tab, label, content } = drawn;
  const iconTexture = useIconRefTexture(solveNode, tab.tab.icon);
  // `tint`, `self_modulate` folded onto `modulate`, composes into every colour before its
  // sRGB-to-linear conversion, as in `PanelChrome.tsx`.
  const tintedFontColor = tintColor(tab.fontColor, tint.own);
  const iconModulate = useIconModulate(tab.iconColor, tint.own);
  const closeLinearColor = useItemLinearColor(tint.own);

  return (
    <CanvasItemGroup position={[drawn.x, 0, 0]}>
      <FlippableStyleBox
        box={tab.style}
        isFlipped={isStyleFlipped}
        tint={tint}
        rect={{ x: 0, y: 0, w: drawn.width, h: barHeight }}
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
      {content.text && (
        <CanvasItemGroup position={[content.text.offset.x, -content.text.offset.y, 0]}>
          <TextRun
            layout={label}
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
  arrows: ScrollArrowsLayout;
  incrementIconTexture: ReturnType<typeof useNodeIcon>;
  decrementIconTexture: ReturnType<typeof useNodeIcon>;
  incrementIconSize: Vector2;
  decrementIconSize: Vector2;
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

/** The scroll arrows `tabBarLayout` places (`tab_bar.cpp:564-592`). */
function ScrollArrows({
  arrows,
  incrementIconTexture,
  decrementIconTexture,
  incrementIconSize,
  decrementIconSize,
  tint,
  renderOrder,
}: ScrollArrowsProps) {
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
