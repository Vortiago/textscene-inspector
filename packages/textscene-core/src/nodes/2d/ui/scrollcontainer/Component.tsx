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
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import { H_SCROLL, SCROLL_HINT_BOTTOM_RIGHT, SCROLL_HINT_TOP_LEFT, V_SCROLL } from './internalBackPieces';

export function ScrollContainer({
  solveNode,
  childTint,
  rect,
  chromeSlot,
  pieceSlots,
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

  // The bars and hints are all child Controls (`scroll_container.cpp:909-924`), so the container's
  // `self_modulate` stays off them. The hint's `modulate` composes onto the child tint, in the order
  // `<StyleBoxQuad>` composes a fill.
  const scrollBarBoxes = internalScrollBarBoxes(solveNode);
  const hintColor = useMemo(() => childTint.color.clone().multiply(SCROLL_HINT_MODULATE), [childTint.color]);

  return (
    <CanvasItemGroup ref={anchorRef}>
      <ControlClipProvider value={clip}>
        <ScrollHintChrome
          hint={layout.hints.topLeft}
          color={hintColor}
          opacity={childTint.opacity}
          chromeSlot={pieceSlots.get(SCROLL_HINT_TOP_LEFT) ?? chromeSlot}
        />
        <ScrollHintChrome
          hint={layout.hints.bottomRight}
          color={hintColor}
          opacity={childTint.opacity}
          chromeSlot={pieceSlots.get(SCROLL_HINT_BOTTOM_RIGHT) ?? chromeSlot}
        />
        {/* `INTERNAL_MODE_BACK` children (`scroll_container.cpp:919,924`): the bars paint after every
            descendant, or each at its own place in a y-sort that collects them. */}
        <ScrollBarChrome
          name={H_SCROLL}
          bar={layout.horizontal}
          boxes={scrollBarBoxes.horizontal}
          color={childTint.own}
          chromeSlot={pieceSlots.get(H_SCROLL) ?? chromeSlot}
          snapToPixels={snapToPixels}
        />
        <ScrollBarChrome
          name={V_SCROLL}
          bar={layout.vertical}
          boxes={scrollBarBoxes.vertical}
          color={childTint.own}
          chromeSlot={pieceSlots.get(V_SCROLL) ?? chromeSlot}
          snapToPixels={snapToPixels}
        />
        {children}
      </ControlClipProvider>
    </CanvasItemGroup>
  );
}
