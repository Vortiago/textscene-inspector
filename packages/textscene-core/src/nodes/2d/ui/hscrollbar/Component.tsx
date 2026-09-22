/**
 * `<HScrollBar>` — the native (WebGL canvas) painter for `HScrollBar`. Draws
 * the two parts `ScrollBar::_notification(NOTIFICATION_DRAW)` paints under
 * this codebase's theme scope (`shared/scrollBarSolver.ts`'s own doc — no
 * increment/decrement icons, both empty in the default theme): the `scroll`
 * track StyleBox across the bar's own full rect, then the `grabber` StyleBox
 * on top, sized/offset from THIS bar's own `Range`
 * (`value`/`min_value`/`max_value`/`page`) — not a ScrollContainer's content,
 * which is `scrollcontainer/Component.tsx`'s own concern. Shared geometry
 * lives in `shared/scrollBarSolver.ts` (also `vscrollbar/Component.tsx`,
 * this component at `vertical = true`); this component only resolves
 * theme/state and draws.
 *
 * Tint: the walker's `tint.own` — composed onto each StyleBox's two base
 * colours, in sRGB, exactly like every other `<StyleBoxQuad>` user here.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { rangeRatio, RANGE_DEFAULT_MAX, RANGE_DEFAULT_MIN, RANGE_DEFAULT_PAGE } from '../shared/range';
import { scrollBarGrabberGeometry, scrollBarGrabberRect, scrollBarTrackRect } from '../shared/scrollBarSolver';
import type { HScrollBarProperties } from './types';

export function HScrollBar({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = painterView<HScrollBarProperties>(solveNode);
  const size = { x: rect.w, y: rect.h };
  const min = props.minValue ?? RANGE_DEFAULT_MIN;
  const max = props.maxValue ?? RANGE_DEFAULT_MAX;
  const page = props.page ?? RANGE_DEFAULT_PAGE;
  const ratio = rangeRatio(props, controlLayoutOrder(solveNode));

  const trackBase = solveNode.styleBoxes.scroll ?? theme.widgets.scrollBar.scrollHorizontal;
  const grabberBase = solveNode.styleBoxes.grabber ?? theme.widgets.scrollBar.grabber;

  const trackRect = scrollBarTrackRect(size);
  const grabber = scrollBarGrabberGeometry(false, size.x, theme, min, max, page, ratio);
  const grabberRect = scrollBarGrabberRect(false, size, grabber);

  return (
    <>
      <CanvasItemGroup position={[trackRect.x, -trackRect.y, 0]}>
        <StyleBoxQuad
          styleBox={trackBase}
          color={tint.own}
          rect={{ x: 0, y: 0, w: trackRect.w, h: trackRect.h }}
          renderOrder={renderOrder}
        />
      </CanvasItemGroup>
      <CanvasItemGroup position={[grabberRect.x, -grabberRect.y, 0]}>
        <StyleBoxQuad
          styleBox={grabberBase}
          color={tint.own}
          rect={{ x: 0, y: 0, w: grabberRect.w, h: grabberRect.h }}
          renderOrder={renderOrder}
        />
      </CanvasItemGroup>
    </>
  );
}
