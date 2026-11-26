import type * as THREE from 'three';
import type { ViewportPointerHandlers } from './useViewportSelection';

export const LEFT = 0;
export const RIGHT = 2;

export interface Click {
  /** The object R3F hits at the release, or null for a release on nothing. */
  readonly on: THREE.Object3D | null;
  /** Pixels between the press and the release. */
  readonly travel?: number;
  readonly button?: number;
}

/** A press, a release and the browser's click after it. A right press sends no click. */
export function clickWith(handlers: ViewportPointerHandlers, { on, travel = 0, button = LEFT }: Click): void {
  const press = { button, clientX: 10, clientY: 10 };
  const release = { ...press, clientX: press.clientX + travel };
  handlers.onCanvasPointerDown(press as PointerEvent);
  if (on) handlers.onPointerUp({ ...release, object: on, stopPropagation: () => {} } as never);
  if (button === LEFT) handlers.onCanvasClick(release as MouseEvent);
}
