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
import { World2DCanvas } from './World2DCanvas.js';
import styles from './Canvas2DStage.module.css';

// The 2D-UI overlay (ADR-0003) is lazy-loaded — keeping the 15 Control
// components + their registrations out of the initial canvas-paint bundle.
// Importing the barrel (`controls/index.js`) rather than ControlOverlay.tsx
// directly is load-bearing: the barrel's side-effect imports are what
// register the Control DOM components.
const ControlOverlay = lazy(() =>
  import('../../controls/index.js').then((m) => ({ default: m.ControlOverlay }))
);

// Godot's default 2D project viewport. The 2D canvas frame uses it as a stable
// surface Control nodes anchor to (mirrors how Godot's 2D editor frames a scene),
// rather than the variable viewport-region size the bare overlay filled before.
const CANVAS_2D_WIDTH = 1152;
const CANVAS_2D_HEIGHT = 648;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

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

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const margin = 56;
    const z = clampZoom(
      Math.min((r.width - margin) / CANVAS_2D_WIDTH, (r.height - margin) / CANVAS_2D_HEIGHT)
    );
    setZoom(z);
    setPan({
      x: (r.width - CANVAS_2D_WIDTH * z) / 2,
      y: (r.height - CANVAS_2D_HEIGHT * z) / 2,
    });
  }, []);

  // Fit on mount.
  useEffect(() => {
    fit();
  }, [fit]);

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
    const z = clampZoom(frame2D.zoom);
    setZoom(z);
    setPan({
      x: r.width / 2 - frame2D.center.x * z,
      y: r.height / 2 - frame2D.center.y * z,
    });
  }, [frame2D]);

  // Wheel-to-zoom, anchored to the cursor. Added as a non-passive native
  // listener so preventDefault actually suppresses page scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const z = zoomRef.current;
      const p = panRef.current;
      const nz = clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      const cx = (px - p.x) / z;
      const cy = (py - p.y) / z;
      setPan({ x: px - cx * nz, y: py - cy * nz });
      setZoom(nz);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag-to-pan via pointer capture (like <Splitter>): the drag keeps tracking
  // off the element with NO window listeners, so an unmount mid-drag can't leak
  // a listener or call setPan on an unmounted component.
  const pan2dDrag = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, active: false });

  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pan2dDrag.current = { startX: e.clientX, startY: e.clientY, ox: pan.x, oy: pan.y, active: true };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported (test env) */
    }
  };
  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = pan2dDrag.current;
    if (!d.active) return;
    setPan({ x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) });
  };
  const endStageDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
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
    const px = r.width / 2;
    const py = r.height / 2;
    const z = zoomRef.current;
    const p = panRef.current;
    const nz = clampZoom(z * factor);
    const cx = (px - p.x) / z;
    const cy = (py - p.y) / z;
    setPan({ x: px - cx * nz, y: py - cy * nz });
    setZoom(nz);
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
    >
      <div
        className={styles.canvasFrame}
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

      {/* The CanvasItem world (sprites/tilemaps), drawn over the frame
          surface and under the Control overlay — Godot's 2D editor order. */}
      <World2DCanvas
        nodes={nodes}
        internalResources={internalResources}
        externalResources={externalResources}
        pan={pan}
        zoom={zoom}
      />

      <div
        className={styles.overlayFrame}
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

      <div className={styles.canvas2dHint}>scroll = zoom · drag = pan</div>

      <div className={styles.zoomHud} role="group" aria-label="Canvas zoom">
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
