/**
 * The native (WebGL canvas) painter for `ScrollContainer`: it clips its
 * subtree through `ControlClipContext` and draws the themed scrollbars and
 * scroll hints. `scene/gui/scroll_bar.cpp` has no autohide gate on a grabber.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { createSolveContext } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { ControlClipProvider, useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ScrollBarChrome, ScrollHintChrome, SCROLL_HINT_MODULATE } from '../shared/ScrollChrome';
import { scrollContainerScrollBars, scrollContainerLayoutChannel } from './nativeSolver';

export function ScrollContainer({
  solveNode,
  tint,
  rect,
  subtreeChromeRenderOrder,
  theme,
  snapToPixels,
  children,
  meta,
}: NativeControlComponentProps) {
  const cachedLayout = scrollContainerLayoutChannel.open(meta) ?? null;
  // Fallback when no layout is sealed: a fresh SolveContext on the real
  // solve's theme and measurer. `solveNode` busts its path-keyed minimum-size
  // cache, so a child whose texture arrives later is not measured stale.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const solveCtx = useMemo(() => createSolveContext(theme, measureText), [theme, solveNode]);
  const layout = useMemo(
    () => cachedLayout ?? scrollContainerScrollBars(solveNode, solveCtx, rect),
    [cachedLayout, solveNode, solveCtx, rect]
  );

  // `Control::clip_contents` clips to `Rect2(Point2(), get_size())`, never reduced
  // by a scrollbar (`scroll_container.cpp`'s constructor: child and focus border
  // share one clip). The origin is whole-pixel snapped and the size is not,
  // which is the pair the scissor reads.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clip } = useWorldClipPlanes(ownRect);

  // The hint's `modulate` composed onto the walker's tint, in the order
  // `<StyleBoxQuad>` composes a fill.
  const hintColor = useMemo(() => tint.color.clone().multiply(SCROLL_HINT_MODULATE), [tint.color]);

  return (
    <CanvasItemGroup ref={anchorRef}>
      <ControlClipProvider value={clip}>
        <ScrollHintChrome
          hint={layout.hints.topLeft}
          color={hintColor}
          opacity={tint.opacity}
          chromeRenderOrder={subtreeChromeRenderOrder}
        />
        <ScrollHintChrome
          hint={layout.hints.bottomRight}
          color={hintColor}
          opacity={tint.opacity}
          chromeRenderOrder={subtreeChromeRenderOrder}
        />
        <ScrollBarChrome
          bar={layout.horizontal}
          track={theme.widgets.scrollBar.scrollHorizontal}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeRenderOrder={subtreeChromeRenderOrder}
          snapToPixels={snapToPixels}
        />
        <ScrollBarChrome
          bar={layout.vertical}
          track={theme.widgets.scrollBar.scrollVertical}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeRenderOrder={subtreeChromeRenderOrder}
          snapToPixels={snapToPixels}
        />
        {children}
      </ControlClipProvider>
    </CanvasItemGroup>
  );
}
