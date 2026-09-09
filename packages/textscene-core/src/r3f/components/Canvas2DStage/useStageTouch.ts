/**
 * The 2D stage's touch gesture: one finger pans, two pan AND pinch together, so
 * a single drag slot cannot hold it. Touch pointers are implicitly captured to
 * the target, so they need no explicit capture.
 */

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  pinchSpanRatio,
  resolveTouchMode,
  touchCentroid,
  touchSpan,
  type TouchPoint,
} from '../../pointerGesture.js';
import { clampZoom, zoomViewAround, type View2D } from './stageView.js';

export interface StageTouch {
  beginTouch: (e: ReactPointerEvent<HTMLDivElement>) => void;
  moveTouch: (e: ReactPointerEvent<HTMLDivElement>) => void;
  endTouch: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export function useStageTouch(
  viewRef: RefObject<View2D>,
  applyView: (next: View2D) => void
): StageTouch {
  const touchPoints = useRef<Map<number, TouchPoint>>(new Map());
  // `startSpan`/`startZoom` are the pinch's anchor: the zoom is MEASURED from
  // where the gesture began, not accumulated move-to-move. A browser fires one
  // pointermove PER POINTER, so two fingers sliding together transit
  // mixed-time states whose span swings hard — 100px apart, briefly 300px once
  // one has moved, 100px again once the other catches up. Multiplying those
  // ratios unwinds the excursion only while nothing clamps it, and `clampZoom`
  // holds a tight [0.1, 4]: one clamped excursion never unwinds, so a plain
  // two-finger pan would silently rescale the stage.
  const touchOrigin = useRef<{
    centroid: TouchPoint;
    span: number;
    startSpan: number;
    startZoom: number;
  } | null>(null);
  // The stage cannot move while fingers are on it, so its rect is read once per
  // gesture rather than per move: the previous move committed new inline styles,
  // so a getBoundingClientRect() here forces a synchronous layout of the whole
  // stage — including the Control overlay — on every single pointermove.
  const touchRect = useRef<DOMRect | null>(null);

  // A window blur is fingers leaving with no pointerup ever arriving: alt-tab
  // mid-gesture would otherwise leave the map holding pointers that never lift,
  // and `resolveTouchMode` would read the next single-finger drag as a pinch.
  // The cleanup doubles as the unmount reset.
  useEffect(() => {
    /**
     * The invariant every touch path maintains: no fingers, no gesture origin. A
     * stale origin is what would make the next single-finger drag pan from
     * wherever a two-finger gesture happened to end — and a stale rect would
     * anchor its pinch to where the stage was before whatever moved it.
     */
    function resetTouch() {
      touchPoints.current.clear();
      touchOrigin.current = null;
      touchRect.current = null;
    }
    window.addEventListener('blur', resetTouch);
    return () => {
      window.removeEventListener('blur', resetTouch);
      resetTouch();
    };
  }, []);

  const beginTouch = (e: ReactPointerEvent<HTMLDivElement>) => {
    touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // A finger landing moves the midpoint discontinuously; drop the origin
    // so the next move re-seeds it instead of panning by the jump.
    touchOrigin.current = null;
    touchRect.current = e.currentTarget.getBoundingClientRect();
  };

  const moveTouch = (e: ReactPointerEvent<HTMLDivElement>) => {
    const points = touchPoints.current;
    if (!points.has(e.pointerId)) return;
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const active = [...points.values()];
    // Both one and two fingers pan here — 2D has no orbit — but the shared
    // resolver still decides what counts as a gesture at all, so the
    // "three fingers is not a gesture" rule lives in one place.
    if (resolveTouchMode(active.length) === null) {
      touchOrigin.current = null;
      return;
    }

    const centroid = touchCentroid(active);
    const span = touchSpan(active);
    const origin = touchOrigin.current;
    const view = viewRef.current;
    // The first move of a gesture only establishes what it started from.
    if (!origin) {
      touchOrigin.current = { centroid, span, startSpan: span, startZoom: view.zoom };
      return;
    }
    touchOrigin.current = { ...origin, centroid, span };

    const dx = centroid.x - origin.centroid.x;
    const dy = centroid.y - origin.centroid.y;
    const panned: View2D = {
      pan: { x: view.pan.x + dx, y: view.pan.y + dy },
      zoom: view.zoom,
    };
    // Not inverted, unlike the 3D viewport: a CSS scale grows as the fingers
    // spread, where an orbit radius shrinks. Measured from the anchor, so a
    // clamp on one event cannot carry into the next.
    const zoom = clampZoom(origin.startZoom * pinchSpanRatio(origin.startSpan, span));
    if (zoom === view.zoom) {
      applyView(panned);
      return;
    }
    const r = touchRect.current ?? e.currentTarget.getBoundingClientRect();
    applyView(
      zoomViewAround(panned, centroid.x - r.left, centroid.y - r.top, zoom / view.zoom)
    );
  };

  const endTouch = (e: ReactPointerEvent<HTMLDivElement>) => {
    touchPoints.current.delete(e.pointerId);
    // Lifting one of two fingers leaves the other mid-gesture; re-seed so it
    // pans from where it is rather than from the old midpoint.
    touchOrigin.current = null;
    if (touchPoints.current.size === 0) touchRect.current = null;
  };

  return { beginTouch, moveTouch, endTouch };
}
