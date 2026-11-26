import type * as THREE from 'three';
import type { ViewportPointerHandlers } from './useViewportSelection';

export const LEFT = 0;
export const RIGHT = 2;

export interface Click {
  /** The object R3F hits at the release, or null for a release on nothing. */
  readonly on: THREE.Object3D | null;
  /** Pixels between the press and the release. */
  readonly travel?: number;
  /** Pixels a move between the press and the release goes out to, or none for no move. */
  readonly wander?: number;
  readonly button?: number;
  readonly altKey?: boolean;
  /** A second touch between the press and the release: how far it moves, and whether it lifts. */
  readonly otherPointer?: { readonly wander: number; readonly lifts: boolean };
}

const PRESS_POINTER_ID = 1;
const OTHER_POINTER_ID = 2;

/** A press, a release and the browser's click after it. A right press sends no click. */
export function clickWith(
  handlers: ViewportPointerHandlers,
  { on, travel = 0, wander, button = LEFT, altKey = false, otherPointer }: Click
): void {
  const press = {
    pointerId: PRESS_POINTER_ID,
    ...{ button, altKey, shiftKey: false, ctrlKey: false, clientX: 10, clientY: 10 },
  };
  const release = { ...press, clientX: press.clientX + travel };
  handlers.onCanvasPointerDown(press as PointerEvent);
  if (wander !== undefined)
    handlers.onWindowPointerMove({ ...press, clientX: press.clientX + wander } as PointerEvent);
  if (otherPointer) moveOtherPointer(handlers, { ...press, pointerId: OTHER_POINTER_ID }, otherPointer);
  if (on) handlers.onPointerUp({ ...release, object: on, stopPropagation: () => {} } as never);
  handlers.onWindowPointerEnd({ ...release, type: 'pointerup' } as PointerEvent);
  if (button === LEFT) handlers.onCanvasClick(release as MouseEvent);
}

function moveOtherPointer(
  handlers: ViewportPointerHandlers,
  at: PointerEventInit,
  { wander, lifts }: NonNullable<Click['otherPointer']>
): void {
  handlers.onWindowPointerMove({ ...at, clientX: at.clientX! + wander } as PointerEvent);
  if (lifts) handlers.onWindowPointerEnd({ ...at, type: 'pointerup' } as PointerEvent);
}
