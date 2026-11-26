/**
 * The 2D viewport (ADR-0007, ADR-0006): a pannable, zoomable stage that shows the
 * whole CanvasItem world in one view, as Godot's 2D editor does. The stage owns
 * the chrome: the project-viewport frame, the zoom HUD, wheel zoom and drag pan.
 * `<World2DCanvas>` draws the world with its camera glued to the stage view.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../../parser/types.js';
import { useEditorCamera2D } from '../editorCamera/useEditorCamera2D.js';
import type { CameraView2D } from '../editorCamera/editorCamera2D.js';
import { createLateReader } from './lateReader.js';
import { isBoolean, readPersisted } from '../../hooks/usePersistedState.js';
import {
  clampWheelNotches,
  isGesturePointer,
  pinchSpanRatio,
  resolveTouchMode,
  touchCentroid,
  touchSpan,
  wheelNotches,
  type TouchPoint,
} from '../pointerGesture.js';
import { World2DCanvas } from '../../world2D/World2DCanvas.js';
import { FIT_ON_OPEN_2D_STORAGE_KEY } from '../../world2D/viewport2d.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { createEditRects, EditRectsProvider } from '../../editRect/editRects.js';
import { useViewFocus } from '../viewFocus.js';
import { FocusSelection2D, Stage2DProvider, type Stage2D } from './FocusSelection2D.js';
import type { StageView } from '../../world2D/stageView.js';
import { createExternalStore } from '../../../utils/externalStore.js';
import { useExternalStoreValue } from '../../hooks/createExternalStore.js';
import type { Rect2 } from '../../../godot/math/rect2.js';
import styles from './Canvas2DStage.module.css';

/** editor_zoom_widget.h:44-45. */
const ZOOM_MIN = 1 / 128;
const ZOOM_MAX = 128;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/** editor_zoom_widget.cpp:46-51: whole percents from 1000 %, else tenths, else hundredths below 10 %. */
function zoomPercentText(zoom: number): string {
  const step = zoom >= 10 ? 1 : zoom >= 0.1 ? 0.1 : 0.01;
  return `${Number((Math.round((zoom * 100) / step) * step).toFixed(2))}%`;
}

/** CSS-scale step for one wheel notch: this stage's own feel, not Godot's. */
const ZOOM_PER_NOTCH = 1.1;

/** The −/+ HUD buttons' step. Coarser than a notch: one click, one visible jump. */
const ZOOM_STEP_BUTTON = 1.2;

/**
 * Scales about a point in stage-local pixels, keeping what sits under it pinned:
 * the cursor for the wheel, the fingers' midpoint for a pinch, the stage centre
 * for the HUD buttons.
 */
function zoomViewAround(view: StageView, px: number, py: number, factor: number): StageView {
  const zoom = clampZoom(view.zoom * factor);
  const cx = (px - view.pan.x) / view.zoom;
  const cy = (py - view.pan.y) / view.zoom;
  return { pan: { x: px - cx * zoom, y: py - cy * zoom }, zoom };
}

const OPENING_VIEW: StageView = { pan: { x: 0, y: 0 }, zoom: 1 };

/** One element for every stage, so a pan leaves the memoised world canvas alone. */
const EDITOR_PARTS = <FocusSelection2D />;

interface Canvas2DStageProps {
  /** The root scene's nodes. The native canvas lays out their Control subtrees. */
  nodes: readonly TscnNode[];
  /** SubResources for StyleBox/Texture refs inside the Control canvas (ADR-0009: explicit props). */
  internalResources: readonly TscnInternalResource[];
  /** ExtResources for texture refs inside the Control canvas (ADR-0009: explicit props). */
  externalResources: readonly TscnExternalResource[];
  /** The scene's `[editable]` paths, which decide the look of a gizmo inside an instance. */
  editableInstances?: readonly string[];
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
  editableInstances,
  scenePath,
}: Canvas2DStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  // State beside the ref, so the keys bind once the element exists.
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null);
  const holdStage = useCallback((element: HTMLDivElement | null) => {
    stageRef.current = element;
    setStageElement(element);
  }, []);
  useViewFocus(stageElement);
  const [editRects] = useState(createEditRects);
  // `display/window/size/viewport_*`, or Godot's 1152x648 for a scene with no
  // project around it. A root Control resolves its anchors to this rect.
  const { width: canvasWidth, height: canvasHeight } = useProjectSettings().viewportSize;

  // Outside React state, which goes stale after a wheel burst's first event. The memoised world follows it.
  const [viewStore] = useState(() => createExternalStore(OPENING_VIEW));
  const { pan, zoom } = useExternalStoreValue(viewStore);

  const applyView = useCallback(
    (next: StageView) => {
      const current = viewStore.get();
      // The store compares by identity, so an equal new view would still re-render the stage chrome.
      if (next.zoom === current.zoom && next.pan.x === current.pan.x && next.pan.y === current.pan.y) {
        return;
      }
      viewStore.set(next);
    },
    [viewStore]
  );

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const margin = 56;
    const zoom = clampZoom(Math.min((r.width - margin) / canvasWidth, (r.height - margin) / canvasHeight));
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
    (next: StageView) => {
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

  // Filled by the keys inside the canvas, where the Live scene tree places each node.
  const rectOf = useRef<(livePath: string) => Rect2 | null>(() => null);
  const [cameraViewOf] = useState(createLateReader<string, CameraView2D | null>);
  // Refs, so a later project size or scene keeps the camera node's backing.
  const openView = useRef(() => {});
  const openScenePath = useRef(scenePath);
  useLayoutEffect(() => {
    openView.current = () => (fitOnOpen ? fit() : applyView(OPENING_VIEW));
    openScenePath.current = scenePath;
  }, [fit, fitOnOpen, applyView, scenePath]);
  // Declared after the fit on open, so a write made before the mount lands on the fitted view.
  useEditorCamera2D(
    useMemo(
      () => ({
        size: () => stageRef.current?.getBoundingClientRect() ?? { width: 0, height: 0 },
        view: viewStore.get,
        moveView,
        restoreView: applyView,
        clampZoom,
        rectOf: (livePath) => rectOf.current(livePath),
        cameraViewOf: (livePath) => cameraViewOf.read(livePath),
        reset: () => openView.current(),
        scenePath: () => openScenePath.current,
      }),
      [moveView, applyView, cameraViewOf, viewStore]
    )
  );

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
        zoomViewAround(viewStore.get(), e.clientX - r.left, e.clientY - r.top, ZOOM_PER_NOTCH ** -notches)
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [moveView, viewStore]);

  // Drag-to-pan through pointer capture, not window listeners: the stage keeps a drag that leaves its edge.
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
    // A press on the stage would start a text selection, and over one a native drag that cancels the pan.
    e.preventDefault();
    // The rendered `pan` is one commit behind a wheel or pinch earlier in this frame.
    const origin = viewStore.get().pan;
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
    const view = viewStore.get();
    // The first move of a gesture only establishes what it started from.
    if (!origin) {
      touchOrigin.current = { centroid, span, startSpan: span, startZoom: view.zoom };
      return;
    }
    touchOrigin.current = { ...origin, centroid, span };

    const dx = centroid.x - origin.centroid.x;
    const dy = centroid.y - origin.centroid.y;
    const panned: StageView = {
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
    moveView(zoomViewAround(panned, centroid.x - r.left, centroid.y - r.top, zoom / view.zoom));
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
      zoom: viewStore.get().zoom,
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

  const stage2D = useMemo<Stage2D>(
    () => ({ stage: stageElement, rectOf, cameraViewOf }),
    [stageElement, cameraViewOf]
  );

  function zoomAroundCentre(factor: number) {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    moveView(zoomViewAround(viewStore.get(), r.width / 2, r.height / 2, factor));
  }

  return (
    <div
      ref={holdStage}
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
        style={
          {
            width: canvasWidth,
            height: canvasHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            '--tsi-stage-zoom': zoom,
          } as CSSProperties
        }
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
      <Stage2DProvider stage={stage2D}>
        <EditRectsProvider rects={editRects}>
          <World2DCanvas
            nodes={nodes}
            internalResources={internalResources}
            externalResources={externalResources}
            editableInstances={editableInstances}
            view={viewStore}
          >
            {EDITOR_PARTS}
          </World2DCanvas>
        </EditRectsProvider>
      </Stage2DProvider>

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

      <div
        className={styles.zoomHud}
        role="group"
        aria-label="Canvas zoom"
        data-testid="canvas-2d-zoom"
        // The stage's drag captures the pointer, and a captured pointer's click never reaches a button.
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={() => zoomAroundCentre(1 / ZOOM_STEP_BUTTON)} aria-label="Zoom out">
          −
        </button>
        <span className={styles.zoomVal}>{zoomPercentText(zoom)}</span>
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
