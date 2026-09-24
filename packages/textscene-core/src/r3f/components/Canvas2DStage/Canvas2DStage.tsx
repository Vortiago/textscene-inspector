/**
 * The 2D viewport (ADR-0007, ADR-0006): a pannable, zoomable stage that shows the
 * whole CanvasItem world in one view, as Godot's 2D editor does. The stage owns
 * the chrome: the project-viewport frame, the zoom HUD, wheel zoom and drag pan.
 * `<World2DCanvas>` draws the world with its camera glued to the stage view.
 */
import {
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

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/** CSS-scale step for one wheel notch: this stage's own feel, not Godot's. */
const ZOOM_PER_NOTCH = 1.1;

/** The −/+ HUD buttons' step. Coarser than a notch: one click, one visible jump. */
const ZOOM_STEP_BUTTON = 1.2;

/** Where the stage is looking: the CSS translate, and the CSS scale. */
interface View2D {
  pan: { x: number; y: number };
  zoom: number;
}

/**
 * Scales about a point in stage-local pixels, keeping what sits under it pinned:
 * the cursor for the wheel, the fingers' midpoint for a pinch, the stage centre
 * for the HUD buttons.
 */
function zoomViewAround(view: View2D, px: number, py: number, factor: number): View2D {
  const zoom = clampZoom(view.zoom * factor);
  const cx = (px - view.pan.x) / view.zoom;
  const cy = (py - view.pan.y) / view.zoom;
  return { pan: { x: px - cx * zoom, y: py - cy * zoom }, zoom };
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export interface Canvas2DStageProps {
  /** The root scene's nodes. The native canvas lays out their Control subtrees. */
  nodes: readonly TscnNode[];
  /** SubResources for StyleBox/Texture refs inside the Control canvas (ADR-0009: explicit props). */
  internalResources: readonly TscnInternalResource[];
  /** ExtResources for texture refs inside the Control canvas (ADR-0009: explicit props). */
  externalResources: readonly TscnExternalResource[];
  /**
   * The path the host opened the scene under. A new one is a scene opening, which starts
   * load time again. An edit or a failed parse of the open scene keeps it.
   */
  scenePath: string;
}

export function Canvas2DStage({
  nodes,
  internalResources,
  externalResources,
  scenePath,
}: Canvas2DStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View2D>({ pan: { x: 0, y: 0 }, zoom: 1 });
  const { pan, zoom } = view;
  // `display/window/size/viewport_*`, or Godot's 1152x648 for a scene with no
  // project around it. A root Control resolves its anchors to this rect.
  const { width: canvasWidth, height: canvasHeight } = useProjectSettings().viewportSize;

  /**
   * The view as of now, written ahead of the re-render. A wheel burst or a pinch
   * fires several events per frame, and React state would be stale after the first.
   */
  const viewRef = useRef(view);

  const applyView = useCallback((next: View2D) => {
    const current = viewRef.current;
    // An identical view still re-renders the stage and the Control overlay.
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

  // Load time runs from a scene opening (mount, or a new `scenePath`) to the user's first
  // pan, zoom or Camera2D framing. Within it, each new viewport size refits, since
  // `project.godot` resolves after the scene does. After it, the view is the user's until
  // the next scene opens. Written by `moveView`, cleared by a scene opening.
  const userMovedViewRef = useRef(false);

  /** A view change the user asked for. It ends load time. */
  const moveView = useCallback(
    (next: View2D) => {
      userMovedViewRef.current = true;
      applyView(next);
    },
    [applyView]
  );

  // Fit on open unless the view is pinned. Read once: the preference decides how a
  // scene opens, and the Fit button stays live either way.
  const [fitOnOpen] = useState(() => readPersisted(FIT_ON_OPEN_2D_STORAGE_KEY, true, isBoolean));
  useEffect(() => {
    userMovedViewRef.current = false;
  }, [scenePath]);
  useEffect(() => {
    if (fitOnOpen && !userMovedViewRef.current) fit();
  }, [fit, fitOnOpen, scenePath]);

  // "View through" a Camera2D: a one-shot request that centres the camera's view
  // point at its magnification. Pan and zoom stay free afterwards.
  const frame2D = useOptionalCameraControl()?.frame2D ?? null;
  useEffect(() => {
    if (!frame2D) return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const zoom = clampZoom(frame2D.zoom);
    moveView({
      zoom,
      pan: {
        x: r.width / 2 - frame2D.center.x * zoom,
        y: r.height / 2 - frame2D.center.y * zoom,
      },
    });
  }, [frame2D, moveView]);

  // Wheel-to-zoom, anchored to the cursor. Added as a non-passive native
  // listener so preventDefault actually suppresses page scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Per notch, not per event (ADR-0029): a trackpad streams fractions of a
      // notch and Firefox reports lines. Per event, a trackpad zooms about ten
      // times faster than a wheel.
      const notches = clampWheelNotches(wheelNotches(e));
      if (notches === 0) return;
      const r = el.getBoundingClientRect();
      moveView(
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
  }, [moveView]);

  // Drag-to-pan through pointer capture, not window listeners, so an unmount
  // mid-drag cannot set state on an unmounted component.
  const pan2dDrag = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, active: false });

  // Touch takes its own path: one finger pans, and two pan and pinch together.
  // Touch pointers are captured to the target implicitly.
  const touchPoints = useRef<Map<number, TouchPoint>>(new Map());
  // The zoom is measured from `startSpan`/`startZoom`, not multiplied move to
  // move. One pointermove per pointer makes the span swing mid-slide, and once
  // `clampZoom` clips a swing it never unwinds, so a two-finger pan would rescale.
  const touchOrigin = useRef<{
    centroid: TouchPoint;
    span: number;
    startSpan: number;
    startZoom: number;
  } | null>(null);
  // Read once per gesture: the stage cannot move under the fingers, and a read
  // per move forces a synchronous layout after the last move's inline styles.
  const touchRect = useRef<DOMRect | null>(null);

  // A window blur lifts fingers with no pointerup, and the next single-finger
  // drag would read as a pinch. The cleanup is the unmount reset too.
  useEffect(() => {
    /** No fingers, no gesture origin and no stale rect, on every touch path. */
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
      // A new finger moves the midpoint in a jump. The next move re-seeds the origin.
      touchOrigin.current = null;
      touchRect.current = e.currentTarget.getBoundingClientRect();
      return;
    }
    if (e.button !== 0) return;
    // From the ref: a wheel or pinch earlier in this frame has written `viewRef`,
    // and the rendered `pan` is one commit behind it.
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
    // One and two fingers both pan, since 2D has no orbit. The shared resolver
    // decides what counts as a gesture.
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
    // spread, where an orbit radius shrinks.
    const zoom = clampZoom(origin.startZoom * pinchSpanRatio(origin.startSpan, span));
    if (zoom === view.zoom) {
      moveView(panned);
      return;
    }
    const r = touchRect.current ?? e.currentTarget.getBoundingClientRect();
    moveView(
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
    moveView({
      pan: { x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) },
      zoom: viewRef.current.zoom,
    });
  };

  const endStageDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isGesturePointer(e.pointerType)) {
      touchPoints.current.delete(e.pointerId);
      // The finger left behind re-seeds, so it pans from where it is.
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
    moveView(zoomViewAround(viewRef.current, r.width / 2, r.height / 2, factor));
  }

  return (
    <div
      ref={stageRef}
      className={styles.canvasStage}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={endStageDrag}
      onPointerCancel={endStageDrag}
      // A pointer can vanish without a pointerup, when capture is stolen or the
      // browser takes the gesture, and leave a finger the next drag reads as a pinch.
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

      {/* Godot's 2D-editor red X and green Y axes through world (0, 0), the
          viewport rect's top-left at screen (pan.x, pan.y). */}
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

      {/* The CanvasItem world and, as a sibling inside this canvas, the native
          Control layer, in Godot's 2D editor order. */}
      <World2DCanvas
        nodes={nodes}
        internalResources={internalResources}
        externalResources={externalResources}
        pan={pan}
        zoom={zoom}
      />

      {/* The project-viewport rectangle a parity capture clips to, by the testid
          `scripts/visual/previewServer.mjs` uses. Nothing mounts into it. */}
      <div
        className={styles.overlayFrame}
        data-testid="canvas-2d-capture-frame"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
        // The frame before the pan and zoom transform. A capture harness reads it
        // to know what zoom 1 means for this scene (`projectViewportSize`).
        data-viewport-size={`${canvasWidth}x${canvasHeight}`}
      />

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
