import { useCallback, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSelection } from '../contexts/SelectionContext.js';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext.js';
import { useHostPick } from '../hostSelection/HostSelection.js';
import { resolvePathFromObject } from './resolvePathFromObject.js';

/** The pointer handlers of the viewport's click picking. Its tests hold Godot's outcome per gesture. */
export interface ViewportPointerHandlers {
  /** Bind to the canvas element, since R3F reports no press on nothing. */
  onCanvasPointerDown: (e: PointerEvent) => void;
  /** Bind to the one root group wrapping the dispatched scene tree: it hears what the press hits. */
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  /** Bind to the window for `pointerup` and `pointercancel`: a release anywhere ends the click. */
  onWindowPointerEnd: (e: PointerEvent) => void;
  /** Bind to the window, so a move off the canvas still turns the press into a drag. */
  onWindowPointerMove: (e: PointerEvent) => void;
}

export interface UseViewportSelectionResult {
  handlers: ViewportPointerHandlers;
}

/** Pixels of pointer travel up to which a press and release is a click (`node_3d_editor_plugin.cpp:2342`). */
const CLICK_TRAVEL_PX = 8;

interface Point {
  readonly clientX: number;
  readonly clientY: number;
}

/** A left press on the canvas, held until its own pointer lifts or the browser cancels it. */
interface Press {
  /** The canvas's pointerdown, which R3F's report of the press hit carries as its native event. */
  readonly event: PointerEvent;
  /** Set by the first move past the click travel: Godot turns the press into a drag for good there. */
  isDrag: boolean;
}

/** The node R3F hits under a press: Godot casts its ray on the press (node_3d_editor_plugin.cpp:2107). */
interface PressHit {
  readonly event: PointerEvent;
  readonly path: string;
}

const isWithinTravel = (press: Point, at: Point) =>
  Math.hypot(at.clientX - press.clientX, at.clientY - press.clientY) <= CLICK_TRAVEL_PX;

/** The press `e` belongs to, or null for none or another pointer's. */
const pressOf = (press: Press | null, e: PointerEvent) =>
  press?.event.pointerId === e.pointerId ? press : null;

// Alt+left orbits or pans (node_3d_editor_plugin.cpp:1986). Godot's mouse is the first touch (input.cpp:849).
const isPickPress = (e: PointerEvent) => e.isPrimary && e.button === 0 && !e.altKey;

export function useViewportSelection(): UseViewportSelectionResult {
  const { setSelectedNodePath, objectPathMap } = useSelection();
  const host = useHostPick();
  // The 2D workspace picks no node yet, so a click on a sprite there would read as a click on nothing.
  const clearsOnNothing = useCanvasWorkspace() === '3d';

  /** Written by a primary press on the canvas, and cleared by the release or the cancel of its pointer. */
  const pressRef = useRef<Press | null>(null);
  /** Written by R3F's report of a press on a node. Read only for the press whose event it carries. */
  const hitRef = useRef<PressHit | null>(null);
  const pick = useCallback(
    (nodePath: string | null) => {
      host.picked(nodePath);
      if (!host.ownsSelection) setSelectedNodePath(nodePath);
    },
    [host, setSelectedNodePath]
  );

  /** A click on nothing is a region select of no size: it clears, unless Shift appends (`:998-1003`). */
  const release = useCallback(
    (press: Press, hit: PressHit | null) => {
      const path = hit?.event === press.event ? hit.path : null;
      if (path) pick(path);
      else if (clearsOnNothing && !press.event.shiftKey) pick(null);
    },
    [pick, clearsOnNothing]
  );

  const handlers = useMemo<ViewportPointerHandlers>(
    () => ({
      onCanvasPointerDown(e) {
        if (!e.isPrimary) return;
        pressRef.current = isPickPress(e) ? { event: e, isDrag: false } : null;
      },
      // R3F reports each hit nearest first, and the first with a node is the one picked.
      onPointerDown(e) {
        const native = e.nativeEvent;
        if (!native.isPrimary || hitRef.current?.event === native) return;
        const path = resolvePathFromObject(e.object, objectPathMap);
        if (!path) return;
        e.stopPropagation();
        hitRef.current = { event: native, path };
      },
      onWindowPointerMove(e) {
        const press = pressOf(pressRef.current, e);
        if (press && !isWithinTravel(press.event, e)) press.isDrag = true;
      },
      onWindowPointerEnd(e) {
        const press = pressOf(pressRef.current, e);
        if (!press) return;
        const hit = hitRef.current;
        pressRef.current = null;
        hitRef.current = null;
        if (e.type === 'pointerup' && !press.isDrag && isWithinTravel(press.event, e)) release(press, hit);
      },
    }),
    [objectPathMap, release]
  );

  return useMemo<UseViewportSelectionResult>(() => ({ handlers }), [handlers]);
}
