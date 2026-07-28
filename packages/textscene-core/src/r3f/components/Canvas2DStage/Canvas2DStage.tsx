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
import { World2DCanvas } from './World2DCanvas.js';
import { CANVAS_2D_WIDTH, CANVAS_2D_HEIGHT, FIT_ON_OPEN_2D_STORAGE_KEY } from './viewport2d.js';
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

/** Below this span a pinch has no direction to read a scale from. */
const DEGENERATE_SPAN_PX = 1e-3;

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

/** Midpoint and separation of the fingers currently down. */
function touchGeometry(points: readonly { x: number; y: number }[]): {
  cx: number;
  cy: number;
  span: number;
} {
  let cx = 0;
  let cy = 0;
  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }
  const [first, second] = points;
  const span = first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  return { cx: cx / points.length, cy: cy / points.length, span };
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Current values mirrored into refs so the non-passive wheel listener (added
  // once) reads fresh state without re-subscribing.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  /**
   * The view as of NOW, not as of the last render: a wheel burst or a pinch
   * fires many events per frame, and reading React state would make every
   * event after the first in a frame compute from a stale pan/zoom.
   */
  const currentView = useCallback(
    (): View2D => ({ pan: panRef.current, zoom: zoomRef.current }),
    []
  );

  /** Commit a view, keeping the refs authoritative ahead of the re-render. */
  const applyView = useCallback((view: View2D) => {
    panRef.current = view.pan;
    zoomRef.current = view.zoom;
    setPan(view.pan);
    setZoom(view.zoom);
  }, []);

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const margin = 56;
    const zoom = clampZoom(
      Math.min((r.width - margin) / CANVAS_2D_WIDTH, (r.height - margin) / CANVAS_2D_HEIGHT)
    );
    applyView({
      zoom,
      pan: {
        x: (r.width - CANVAS_2D_WIDTH * zoom) / 2,
        y: (r.height - CANVAS_2D_HEIGHT * zoom) / 2,
      },
    });
  }, [applyView]);

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
      const r = el.getBoundingClientRect();
      applyView(
        zoomViewAround(
          currentView(),
          e.clientX - r.left,
          e.clientY - r.top,
          e.deltaY < 0 ? 1.1 : 1 / 1.1
        )
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyView, currentView]);

  // Drag-to-pan via pointer capture (like <Splitter>): the drag keeps tracking
  // off the element with NO window listeners, so an unmount mid-drag can't leak
  // a listener or call setPan on an unmounted component.
  const pan2dDrag = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, active: false });

  // Touch takes its own path: one finger pans, two pan AND pinch together, so
  // a single drag slot cannot hold the gesture. Touch pointers are implicitly
  // captured to the target, so they need no explicit capture.
  const touchPoints = useRef<Map<number, { x: number; y: number }>>(new Map());
  const touchOrigin = useRef<{ cx: number; cy: number; span: number } | null>(null);

  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // A finger landing moves the midpoint discontinuously; drop the origin
      // so the next move re-seeds it instead of panning by the jump.
      touchOrigin.current = null;
      return;
    }
    if (e.button !== 0) return;
    pan2dDrag.current = { startX: e.clientX, startY: e.clientY, ox: pan.x, oy: pan.y, active: true };
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
    // Three or more fingers is not a gesture we define; ignore it rather than
    // panning by a midpoint the user is not thinking in terms of.
    if (active.length > 2) {
      touchOrigin.current = null;
      return;
    }

    const now = touchGeometry(active);
    const origin = touchOrigin.current;
    touchOrigin.current = now;
    if (!origin) return;

    const panned: View2D = {
      pan: {
        x: panRef.current.x + (now.cx - origin.cx),
        y: panRef.current.y + (now.cy - origin.cy),
      },
      zoom: zoomRef.current,
    };
    if (origin.span <= DEGENERATE_SPAN_PX || now.span <= DEGENERATE_SPAN_PX) {
      applyView(panned);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    applyView(
      zoomViewAround(panned, now.cx - r.left, now.cy - r.top, now.span / origin.span)
    );
  };

  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      onStageTouchMove(e);
      return;
    }
    const d = pan2dDrag.current;
    if (!d.active) return;
    applyView({
      pan: { x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) },
      zoom: zoomRef.current,
    });
  };

  const endStageDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      touchPoints.current.delete(e.pointerId);
      // Lifting one of two fingers leaves the other mid-gesture; re-seed so it
      // pans from where it is rather than from the old midpoint.
      touchOrigin.current = null;
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
    applyView(zoomViewAround(currentView(), r.width / 2, r.height / 2, factor));
  }

  return (
    <div
      ref={stageRef}
      className={styles.canvasStage}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={endStageDrag}
      onPointerCancel={endStageDrag}
      aria-label="2D canvas"
      data-testid="canvas-2d-stage"
    >
      <div
        className={styles.canvasFrame}
        data-testid="canvas-2d-frame"
        style={{
          width: CANVAS_2D_WIDTH,
          height: CANVAS_2D_HEIGHT,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <span className={styles.canvasDim} aria-hidden>
          {CANVAS_2D_WIDTH} × {CANVAS_2D_HEIGHT}
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
          width: CANVAS_2D_WIDTH,
          height: CANVAS_2D_HEIGHT,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
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
        <button type="button" onClick={() => zoomAroundCentre(1 / 1.2)} aria-label="Zoom out">
          −
        </button>
        <span className={styles.zoomVal}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomAroundCentre(1.2)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={styles.zoomFit} onClick={fit}>
          Fit
        </button>
      </div>
    </div>
  );
}
