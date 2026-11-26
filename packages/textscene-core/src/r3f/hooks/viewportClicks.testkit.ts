import type * as THREE from 'three';
import type { ViewportPointerHandlers } from './useViewportSelection';

export const LEFT = 0;
export const RIGHT = 2;

/** A second touch between the press and the release. */
export interface OtherPointer {
  /** The object R3F hits where it lands on the canvas, null for nothing, or none for a press off it. */
  readonly landsOn?: THREE.Object3D | null;
  readonly wander: number;
  readonly lifts: boolean;
}

export interface Click {
  /** The object R3F hits at the press, or null for a press on nothing. */
  readonly on: THREE.Object3D | null;
  /** Pixels between the press and the release. */
  readonly travel?: number;
  /** Pixels a move between the press and the release goes out to, or none for no move. */
  readonly wander?: number;
  readonly button?: number;
  readonly altKey?: boolean;
  readonly otherPointer?: OtherPointer;
}

const PRESS_POINTER_ID = 1;
const OTHER_POINTER_ID = 2;

type At = Pick<PointerEvent, 'pointerId' | 'button' | 'altKey' | 'clientX' | 'clientY'>;

/** A press on the canvas, heard by the canvas and then by R3F on the object it hits, if any. */
function pressAt(handlers: ViewportPointerHandlers, at: At, on: THREE.Object3D | null): void {
  const event = at as PointerEvent;
  handlers.onCanvasPointerDown(event);
  if (on)
    handlers.onPointerDown({ ...at, nativeEvent: event, object: on, stopPropagation: () => {} } as never);
}

/** A press, a release and the browser's click after it. A right press sends no click. */
export function clickWith(
  handlers: ViewportPointerHandlers,
  { on, travel = 0, wander, button = LEFT, altKey = false, otherPointer }: Click
): void {
  const press = { pointerId: PRESS_POINTER_ID, button, altKey, clientX: 10, clientY: 10 };
  const release = { ...press, clientX: press.clientX + travel };
  pressAt(handlers, press, on);
  if (wander !== undefined)
    handlers.onWindowPointerMove({ ...press, clientX: press.clientX + wander } as PointerEvent);
  if (otherPointer) touchOther(handlers, { ...press, pointerId: OTHER_POINTER_ID }, otherPointer);
  handlers.onWindowPointerEnd({ ...release, type: 'pointerup' } as PointerEvent);
  if (button === LEFT) handlers.onCanvasClick(release as PointerEvent);
}

function touchOther(
  handlers: ViewportPointerHandlers,
  at: At,
  { landsOn, wander, lifts }: OtherPointer
): void {
  if (landsOn !== undefined) pressAt(handlers, at, landsOn);
  handlers.onWindowPointerMove({ ...at, clientX: at.clientX + wander } as PointerEvent);
  if (lifts) handlers.onWindowPointerEnd({ ...at, type: 'pointerup' } as PointerEvent);
}
