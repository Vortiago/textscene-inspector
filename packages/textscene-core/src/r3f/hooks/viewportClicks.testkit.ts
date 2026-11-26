import type * as THREE from 'three';
import type { ViewportPointerHandlers } from './useViewportSelection';

export const LEFT = 0;
export const MIDDLE = 1;
export const RIGHT = 2;

export interface Modifiers {
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
}

/** The first touch is the primary pointer, which a mouse or a pen always is. The second is not. */
export type Pointer = 'first' | 'second';

/** One pointer event of a gesture. A move or a release is the pixels right of that pointer's press. */
export type Step =
  | {
      readonly press: THREE.Object3D | null;
      readonly button?: number;
      readonly mods?: Modifiers;
      readonly pointer?: Pointer;
    }
  | { readonly move: number; readonly pointer?: Pointer }
  | { readonly release: number; readonly pointer?: Pointer }
  | { readonly cancel: true; readonly pointer?: Pointer }
  /** A left button pressed or let go while another is held, which the browser sends as a move. */
  | { readonly chordLeft: 'down' | 'up' };

const ORIGINS: Record<
  Pointer,
  { readonly pointerId: number; readonly clientX: number; readonly clientY: number }
> = {
  first: { pointerId: 1, clientX: 10, clientY: 10 },
  second: { pointerId: 2, clientX: 50, clientY: 50 },
};

/** Sends each step as the browser and R3F report it: the canvas and then R3F hear a press. */
export function perform(handlers: ViewportPointerHandlers, steps: readonly Step[]): void {
  const pressed = new Map<Pointer, { button: number; mods: Modifiers }>();
  const eventAt = (pointer: Pointer, dx: number) => {
    const origin = ORIGINS[pointer];
    const { button = LEFT, mods = {} } = pressed.get(pointer) ?? {};
    return { ...origin, ...mods, button, isPrimary: pointer === 'first', clientX: origin.clientX + dx };
  };
  for (const step of steps) {
    if ('chordLeft' in step) {
      handlers.onWindowPointerMove({ ...eventAt('first', 0), button: LEFT } as PointerEvent);
      continue;
    }
    const pointer = step.pointer ?? 'first';
    if ('press' in step) {
      pressed.set(pointer, { button: step.button ?? LEFT, mods: step.mods ?? {} });
      const event = eventAt(pointer, 0) as PointerEvent;
      handlers.onCanvasPointerDown(event);
      if (step.press)
        handlers.onPointerDown({
          ...event,
          nativeEvent: event,
          object: step.press,
          stopPropagation: () => {},
        } as never);
    } else if ('move' in step) {
      handlers.onWindowPointerMove(eventAt(pointer, step.move) as PointerEvent);
    } else if ('release' in step) {
      handlers.onWindowPointerEnd({ ...eventAt(pointer, step.release), type: 'pointerup' } as PointerEvent);
    } else {
      handlers.onWindowPointerEnd({ ...eventAt(pointer, 0), type: 'pointercancel' } as PointerEvent);
    }
  }
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
}

/** A press and its release, with a move between them when `wander` is given. */
export function clickWith(
  handlers: ViewportPointerHandlers,
  { on, travel = 0, wander, button = LEFT, altKey = false }: Click
): void {
  const steps: Step[] = [{ press: on, button, mods: { altKey } }];
  if (wander !== undefined) steps.push({ move: wander });
  steps.push({ release: travel });
  perform(handlers, steps);
}
