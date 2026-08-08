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
 *
 * The view algebra is in `stageView.ts` and the gestures that drive it in
 * `useStageGestures.ts`.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type {
  TscnNode,
  TscnExternalResource,
  TscnInternalResource,
} from '../../../parser/types.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { readPersisted } from '../../hooks/usePersistedState.js';
import { World2DCanvas } from './World2DCanvas.js';
import { FIT_ON_OPEN_2D_STORAGE_KEY } from './viewport2d.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { clampZoom, type View2D } from './stageView.js';
import { useStageGestures } from './useStageGestures.js';
import { Canvas2DZoomHud } from './Canvas2DZoomHud.js';
import styles from './Canvas2DStage.module.css';

// The 2D-UI overlay (ADR-0003) is lazy-loaded — keeping the 15 Control
// components + their registrations out of the initial canvas-paint bundle.
// Importing the barrel (`controls/index.js`) rather than ControlOverlay.tsx
// directly is load-bearing: the barrel's side-effect imports are what
// register the Control DOM components.
const ControlOverlay = lazy(() =>
  import('../../controls/index.js').then((m) => ({ default: m.ControlOverlay }))
);

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

  const { onStagePointerDown, onStagePointerMove, endStageDrag, zoomAroundCentre } =
    useStageGestures(stageRef, viewRef, applyView);

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

      <Canvas2DZoomHud zoom={zoom} zoomAroundCentre={zoomAroundCentre} fit={fit} />
    </div>
  );
}
