/**
 * The 2D viewport (ADR-0007 + ADR-0006 Godot-parity amendment): a pannable/
 * zoomable stage compositing — like Godot's 2D editor — the whole CanvasItem
 * world in one view:
 *   1. the canvas frame (Godot's project-viewport rectangle),
 *   2. the `<World2DCanvas>` (transparent ortho R3F layer: sprites, tilemaps,
 *      Node2D trees), camera glued to the stage pan/zoom,
 *   3. the `<ControlOverlay>` (DOM Control layout) on top.
 * The overlay still does the real Control layout; the stage owns the chrome
 * (bounds, zoom %, scroll-to-zoom, drag-to-pan).
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  TscnNode,
  TscnExternalResource,
  TscnInternalResource,
} from '../../../parser/types.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { readPersisted } from '../../hooks/usePersistedState.js';
import {
  clampWheelNotches,
  isGesturePointer,
  pinchSpanRatio,
  resolveTouchMode,
  touchCentroid,
  touchSpan,
  wheelNotches,
  type TouchPoint,
} from '../../pointerGesture.js';
import { World2DCanvas } from './World2DCanvas.js';
import { FIT_ON_OPEN_2D_STORAGE_KEY } from './viewport2d.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import styles from './Canvas2DStage.module.css';

// The 2D-UI overlay (ADR-0003) is lazy-loaded — keeping the 15 Control
// components + their registrations out of the initial canvas-paint bundle.
// Importing the barrel (`controls/index.js`) rather than ControlOverlay.tsx
// directly is load-bearing: the barrel's side-effect imports are what
// register the Control DOM components.
const ControlOverlay = lazy(() =>
  import('../../controls/index.js').then((m) => ({ default: m.ControlOverlay }))
);

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/** CSS-scale step for one wheel notch — this stage's own feel, not Godot's. */
const ZOOM_PER_NOTCH = 1.1;

/** The −/+ HUD buttons' step. Coarser than a notch: one click, one visible jump. */
const ZOOM_STEP_BUTTON = 1.2;

/** Where the stage is looking: the CSS translate, and the CSS scale. */
interface View2D {
  pan: { x: number; y: number };
  zoom: number;
}

/**
 * Scale about a point in stage-local pixels, keeping whatever sits under that
 * point pinned to it. Pure, so the three callers that need it — wheel (anchored
 * to the cursor), pinch (to the fingers' midpoint), HUD buttons (to the stage
 * centre) — share one implementation instead of three copies of the algebra.
 */
function zoomViewAround(view: View2D, px: number, py: number, factor: number): View2D {
  const zoom = clampZoom(view.zoom * factor);
  const cx = (px - view.pan.x) / view.zoom;
  const cy = (py - view.pan.y) / view.zoom;
  return { pan: { x: px - cx * zoom, y: py - cy * zoom }, zoom };
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export interface Canvas2DStageProps {
  /** Root scene's nodes — the overlay lays out the Control subtree(s) within. */
  nodes: readonly TscnNode[];
  /** SubResources for StyleBox/Texture refs inside the overlay (ADR-0009: explicit props). */
  internalResources: readonly TscnInternalResource[];
  /** ExtResources for texture refs inside the overlay (ADR-0009: explicit props). */
  externalResources: readonly TscnExternalResource[];
}

export function Canvas2DStage({
  nodes,
  internalResources,
  externalResources,
}: Canvas2DStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View2D>({ pan: { x: 0, y: 0 }, zoom: 1 });
  const { pan, zoom } = view;
  // `display/window/size/viewport_*`, or Godot's 1152x648 for a scene with no
  // project around it. This rect is what a root Control resolves its anchors
  // to, so 23 of the corpus's 81 projects were being composed against the
  // wrong frame while it was a module constant.
  const { width: canvasWidth, height: canvasHeight } = useProjectSettings().viewportSize;

  /**
   * The view as of NOW, not as of the last render. A wheel burst or a pinch
   * fires several events per frame, and reading React state would make every
   * event after the first in a frame compute from a stale view — so the ref is
   * written ahead of the re-render and is what the handlers read.
   */
  const viewRef = useRef(view);

  const applyView = useCallback((next: View2D) => {
    const current = viewRef.current;
    // A commit identical to the current view still re-renders the stage and
    // the Control overlay. Every committer (drag, touch, wheel, HUD buttons)
    // crosses this seam, so the no-op rule lives here once.
    if (next.zoom === current.zoom && next.pan.x === current.pan.x && next.pan.y === current.pan.y) {
      return;
    }
    viewRef.current = next;
    setView(next);
  }, []);

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const margin = 56;
    const zoom = clampZoom(
      Math.min((r.width - margin) / canvasWidth, (r.height - margin) / canvasHeight)
    );
    applyView({
      zoom,
      pan: {
        x: (r.width - canvasWidth * zoom) / 2,
        y: (r.height - canvasHeight * zoom) / 2,
      },
    });
  }, [applyView, canvasWidth, canvasHeight]);

  // Fit on mount, unless the view is pinned (read once — the preference decides
  // how this scene OPENS; the Fit button and pan/zoom stay live either way).
  const [fitOnOpen] = useState(() => readPersisted(FIT_ON_OPEN_2D_STORAGE_KEY, true, isBoolean));
  useEffect(() => {
    if (fitOnOpen) fit();
  }, [fit, fitOnOpen]);

  // "View through" a Camera2D (Cameras panel): one-shot framing request —
  // center the camera's view point at its magnification; the user keeps free
  // pan/zoom afterwards.
  const frame2D = useOptionalCameraControl()?.frame2D ?? null;
  useEffect(() => {
    if (!frame2D) return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const zoom = clampZoom(frame2D.zoom);
    applyView({
      zoom,
      pan: {
        x: r.width / 2 - frame2D.center.x * zoom,
        y: r.height / 2 - frame2D.center.y * zoom,
      },
    });
  }, [frame2D, applyView]);

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
  }, [applyView]);

  // Drag-to-pan via pointer capture (like <Splitter>): the mouse drag keeps
  // tracking off the element rather than off window listeners, so an unmount
  // mid-drag can't call setPan on an unmounted component.
  const pan2dDrag = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, active: false });

  // Touch takes its own path: one finger pans, two pan AND pinch together, so
  // a single drag slot cannot hold the gesture. Touch pointers are implicitly
  // captured to the target, so they need no explicit capture.
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

  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isGesturePointer(e.pointerType)) {
      touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // A finger landing moves the midpoint discontinuously; drop the origin
      // so the next move re-seeds it instead of panning by the jump.
      touchOrigin.current = null;
      touchRect.current = e.currentTarget.getBoundingClientRect();
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

  const onStageTouchMove = (e: ReactPointerEvent<HTMLDivElement>) => {
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

  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isGesturePointer(e.pointerType)) {
      onStageTouchMove(e);
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
      touchPoints.current.delete(e.pointerId);
      // Lifting one of two fingers leaves the other mid-gesture; re-seed so it
      // pans from where it is rather than from the old midpoint.
      touchOrigin.current = null;
      if (touchPoints.current.size === 0) touchRect.current = null;
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

  return (
    <div
      ref={stageRef}
      className={styles.canvasStage}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={endStageDrag}
      onPointerCancel={endStageDrag}
      // A pointer can vanish without a pointerup — capture stolen, or the
      // browser taking the gesture over — which would leave a finger in the map
      // for the next drag to misread as a pinch.
      onLostPointerCapture={endStageDrag}
      aria-label="2D canvas"
      data-testid="canvas-2d-stage"
    >
      <div
        className={styles.canvasFrame}
        data-testid="canvas-2d-frame"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <span className={styles.canvasDim} aria-hidden>
          {canvasWidth} × {canvasHeight}
        </span>
      </div>

      {/* Origin axes through world (0, 0) = the viewport rect's top-left at
          screen (pan.x, pan.y) — Godot's 2D-editor red X / green Y. */}
      <div
        className={`${styles.originAxis} ${styles.originAxisX}`}
        style={{ top: pan.y }}
        data-testid="origin-axis-x"
        aria-hidden
      />
      <div
        className={`${styles.originAxis} ${styles.originAxisY}`}
        style={{ left: pan.x }}
        data-testid="origin-axis-y"
        aria-hidden
      />

      {/* The CanvasItem world (sprites/tilemaps), drawn over the frame
          surface and under the Control overlay — Godot's 2D editor order. */}
      <World2DCanvas
        nodes={nodes}
        internalResources={internalResources}
        externalResources={externalResources}
        pan={pan}
        zoom={zoom}
      />

      {/* The Godot project-viewport rectangle in the DOM: the Control overlay's
          own box, and the region a parity capture clips to (its testid is the
          contract `scripts/visual/previewServer.mjs` addresses it by). */}
      <div
        className={styles.overlayFrame}
        data-testid="canvas-2d-capture-frame"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
        // The rect this frame IS, before the stage's pan/zoom transform. A
        // capture harness reads it to know what "zoom 1" means for THIS scene:
        // the frame is the project's viewport, so it is no longer a constant it
        // can hardcode (`projectViewportSize`).
        data-viewport-size={`${canvasWidth}x${canvasHeight}`}
      >
        <Suspense
          fallback={
            <div className={styles.loading} aria-busy="true">
              Loading 2D overlay…
            </div>
          }
        >
          <ControlOverlay
            nodes={nodes}
            internalResources={internalResources}
            externalResources={externalResources}
          />
        </Suspense>
      </div>

      <div className={styles.zoomHud} role="group" aria-label="Canvas zoom" data-testid="canvas-2d-zoom">
        <button type="button" onClick={() => zoomAroundCentre(1 / ZOOM_STEP_BUTTON)} aria-label="Zoom out">
          −
        </button>
        <span className={styles.zoomVal}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomAroundCentre(ZOOM_STEP_BUTTON)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={styles.zoomFit} onClick={fit}>
          Fit
        </button>
      </div>
    </div>
  );
}
