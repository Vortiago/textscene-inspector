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
  /** Bind to the canvas element. The browser sends it after the release a node picks on. */
  onCanvasClick: (e: MouseEvent) => void;
  /** Bind to the one root group wrapping the dispatched scene tree. */
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  /** Bind to the window for `pointerup` and `pointercancel`, which it hears after R3F's release. */
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
  /** A second touch moves and lifts with its own id, and ends nothing of this press. */
  readonly pointerId: number;
  isReleased: boolean;
  /** Set by the first move past the click travel: Godot turns the press into a drag for good there. */
  isDrag: boolean;
}

const isWithinTravel = (press: Point, at: Point) =>
  Math.hypot(at.clientX - press.clientX, at.clientY - press.clientY) <= CLICK_TRAVEL_PX;

const isClick = (press: Press, release: Point) => !press.isDrag && isWithinTravel(press, release);

/** The press `e` belongs to, or null for none or another pointer's. */
const pressOf = (press: Press | null, e: Pick<PointerEvent, 'pointerId'>) =>
  press?.pointerId === e.pointerId ? press : null;

// A left press with Alt orbits or pans, as the editor view's map holds (`node_3d_editor_plugin.cpp:1986`).
const isPickPress = (e: PointerEvent) => e.button === 0 && !e.altKey;

export function useViewportSelection(): UseViewportSelectionResult {
  const { setSelectedNodePath, objectPathMap } = useSelection();
  const host = useHostPick();
  // The 2D workspace picks no node yet, so a click on a sprite there would read as a click on nothing.
  const clearsOnNothing = useCanvasWorkspace() === '3d';

  /** Written by the canvas press, and cleared by the pick, the click or the cancel that ends it. */
  const pressRef = useRef<Press | null>(null);
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
        pressRef.current = isPickPress(e)
          ? {
              pointerId: e.pointerId,
              clientX: e.clientX,
              clientY: e.clientY,
              isReleased: false,
              isDrag: false,
            }
          : null;
      },
      onPointerUp(e) {
        const press = pressOf(pressRef.current, e);
        if (!press || press.isReleased || !isClick(press, e)) return;
        const path = resolvePathFromObject(e.object, objectPathMap);
        if (!path) return;
        e.stopPropagation();
        pressRef.current = null;
        pick(path);
      },
      // A click on nothing is a region select of no size, which clears (node_3d_editor_plugin.cpp:998-1003).
      onCanvasClick(e) {
        const press = pressRef.current;
        pressRef.current = null;
        if (press && isClick(press, e) && clearsOnNothing) pick(null);
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
