/**
 * Pan and zoom for the 2D stage: the native wheel listener, the mouse drag, and
 * the HUD's zoom-about-centre. The touch path is its own mechanism and lives in
 * `useStageTouch.ts`; this is where a pointer event is routed to one or the
 * other.
 *
 * The handlers are recreated per render and attached inline to the stage div —
 * the wheel is the one exception, since suppressing page scroll needs a
 * non-passive native listener.
 */

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  clampWheelNotches,
  isGesturePointer,
  wheelNotches,
} from '../../pointerGesture.js';
import { zoomViewAround, ZOOM_PER_NOTCH, type View2D } from './stageView.js';
import { useStageTouch } from './useStageTouch.js';

export interface StageGestures {
  onStagePointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onStagePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  endStageDrag: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** The −/+ HUD buttons: scale about the stage's own centre. */
  zoomAroundCentre: (factor: number) => void;
}

export function useStageGestures(
  stageRef: RefObject<HTMLDivElement | null>,
  /**
   * The view as of NOW, not as of the last render. A wheel burst or a pinch
   * fires several events per frame, and reading React state would make every
   * event after the first in a frame compute from a stale view — so the ref is
   * written ahead of the re-render and is what the handlers read.
   */
  viewRef: RefObject<View2D>,
  applyView: (next: View2D) => void
): StageGestures {
  // Wheel-to-zoom, anchored to the cursor. Added as a non-passive native
  // listener so preventDefault actually suppresses page scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Per NOTCH, not per event (ADR-0029): a mouse wheel delivers one notch
      // per event and still steps by ZOOM_PER_NOTCH, but a trackpad streams
      // fractions of one and Firefox reports lines rather than pixels. Scaling
      // by the event count instead would zoom a trackpad roughly an order of
      // magnitude faster than a wheel for the same physical gesture.
      const notches = clampWheelNotches(wheelNotches(e));
      if (notches === 0) return;
      const r = el.getBoundingClientRect();
      applyView(
        zoomViewAround(
          viewRef.current,
          e.clientX - r.left,
          e.clientY - r.top,
          ZOOM_PER_NOTCH ** -notches
        )
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyView, stageRef, viewRef]);

  // Drag-to-pan via pointer capture (like <Splitter>): the mouse drag keeps
  // tracking off the element rather than off window listeners, so an unmount
  // mid-drag can't call setPan on an unmounted component.
  const pan2dDrag = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, active: false });

  const { beginTouch, moveTouch, endTouch } = useStageTouch(viewRef, applyView);

  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isGesturePointer(e.pointerType)) {
      beginTouch(e);
      return;
    }
    if (e.button !== 0) return;
    // The origin comes from the ref, not the render: a wheel or pinch earlier
    // in this same frame has already written `viewRef` and the rendered `pan`
    // is one commit behind it, which would start the drag from a stale offset.
    const origin = viewRef.current.pan;
    pan2dDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: origin.x,
      oy: origin.y,
      active: true,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
  };

  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isGesturePointer(e.pointerType)) {
      moveTouch(e);
      return;
    }
    const d = pan2dDrag.current;
    if (!d.active) return;
    applyView({
      pan: { x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) },
      zoom: viewRef.current.zoom,
    });
  };

  const endStageDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isGesturePointer(e.pointerType)) {
      endTouch(e);
      return;
    }
    if (!pan2dDrag.current.active) return;
    pan2dDrag.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
  };

  function zoomAroundCentre(factor: number) {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    applyView(zoomViewAround(viewRef.current, r.width / 2, r.height / 2, factor));
  }

  return { onStagePointerDown, onStagePointerMove, endStageDrag, zoomAroundCentre };
}
