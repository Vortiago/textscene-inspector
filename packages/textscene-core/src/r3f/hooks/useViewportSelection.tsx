import { useCallback, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSelection } from '../contexts/SelectionContext.js';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext.js';
import { useHostPick } from '../hostSelection/HostSelection.js';
import { resolvePathFromObject } from './resolvePathFromObject.js';

/** The pointer handlers of the viewport's click picking. */
export interface ViewportPointerHandlers {
  /** Bind to the canvas element, since R3F reports no press on nothing. */
  onCanvasPointerDown: (e: PointerEvent) => void;
  /** Bind to the canvas element. The browser sends it after the release, and it picks. */
  onCanvasClick: (e: MouseEvent) => void;
  /** Bind to the one root group wrapping the dispatched scene tree: it hears what the press hits. */
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  /** Bind to the window for `pointerup` and `pointercancel`, so a release off the canvas ends the press. */
  onWindowPointerEnd: (e: PointerEvent) => void;
  /** Bind to the window, so a move off the canvas still ends the click. */
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

/** A left press on the canvas. Once released, only the click that follows may still read it. */
interface Press extends Point {
  /** The canvas's pointerdown, which R3F's report of the press hit carries as its native event. */
  readonly event: PointerEvent;
  readonly pointerId: number;
  isReleased: boolean;
  /** Set by the first move past the click travel: Godot turns the press into a drag for good there. */
  isDrag: boolean;
}

const isWithinTravel = (press: Point, at: Point) =>
  Math.hypot(at.clientX - press.clientX, at.clientY - press.clientY) <= CLICK_TRAVEL_PX;

const isClick = (press: Press, release: Point) => !press.isDrag && isWithinTravel(press, release);

/** The node R3F hits under a press: Godot casts its ray on the press (node_3d_editor_plugin.cpp:2107). */
interface PressHit {
  readonly event: PointerEvent;
  readonly path: string;
}

/** The press `e` belongs to, or null for none or another pointer's. */
const pressOf = (press: Press | null, e: Pick<PointerEvent, 'pointerId'>) =>
  press?.pointerId === e.pointerId ? press : null;

/** True while another pointer holds a press: a second touch ends nothing of it, and starts none. */
const isHeldByOther = (held: Press | null, e: Pick<PointerEvent, 'pointerId'>) =>
  !!held && !held.isReleased && held.pointerId !== e.pointerId;

// A left press with Alt orbits or pans, as the editor view's map holds (`node_3d_editor_plugin.cpp:1986`).
const isPickPress = (e: PointerEvent) => e.button === 0 && !e.altKey;

export function useViewportSelection(): UseViewportSelectionResult {
  const { setSelectedNodePath, objectPathMap } = useSelection();
  const host = useHostPick();
  // The 2D workspace picks no node yet, so a click on a sprite there would read as a click on nothing.
  const clearsOnNothing = useCanvasWorkspace() === '3d';

  /** Written by the canvas press, and cleared by the click or the cancel that ends it. */
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

  const handlers = useMemo<ViewportPointerHandlers>(
    () => ({
      onCanvasPointerDown(e) {
        if (isHeldByOther(pressRef.current, e)) return;
        pressRef.current = isPickPress(e)
          ? {
              event: e,
              pointerId: e.pointerId,
              clientX: e.clientX,
              clientY: e.clientY,
              isReleased: false,
              isDrag: false,
            }
          : null;
      },
      // R3F reports each hit nearest first, and the first with a node is the one picked.
      onPointerDown(e) {
        if (hitRef.current?.event === e.nativeEvent || isHeldByOther(pressRef.current, e)) return;
        const path = resolvePathFromObject(e.object, objectPathMap);
        if (!path) return;
        e.stopPropagation();
        hitRef.current = { event: e.nativeEvent, path };
      },
      // A click on nothing is a region select of no size, which clears (node_3d_editor_plugin.cpp:998-1003).
      onCanvasClick(e) {
        const press = pressRef.current;
        const hit = hitRef.current;
        pressRef.current = null;
        hitRef.current = null;
        if (!press || !isClick(press, e)) return;
        const path = hit?.event === press.event ? hit.path : null;
        if (path || clearsOnNothing) pick(path);
      },
      onWindowPointerMove(e) {
        const press = pressOf(pressRef.current, e);
        if (press && !press.isReleased && !isWithinTravel(press, e)) press.isDrag = true;
      },
      onWindowPointerEnd(e) {
        const press = pressOf(pressRef.current, e);
        if (!press) return;
        if (e.type === 'pointercancel') pressRef.current = null;
        else press.isReleased = true;
      },
    }),
    [pick, objectPathMap, clearsOnNothing]
  );

  return useMemo<UseViewportSelectionResult>(() => ({ handlers }), [handlers]);
}
