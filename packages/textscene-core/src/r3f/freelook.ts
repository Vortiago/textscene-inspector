/**
 * Freelook for one canvas: whether it is on, which flight keys are held, and the flight speed.
 * Godot keeps the same three per viewport (`freelook_active`, its input map and `freelook_speed`).
 * It is on while the right button is held, or from the toggle until the pointer lock ends.
 */
import { freelookDirectionOf } from './editorKeyBindings.js';
import {
  FREELOOK_BASE_SPEED,
  freelookMoveCursor,
  scaleFreelookSpeed,
  type EditorCursor,
  type FreelookKeys,
  type ZoomRange,
} from './godotEditorCursor.js';

/** What a toolbar and a speed readout show. A new object on each change, so a store can compare it. */
export interface FreelookState {
  readonly isToggled: boolean;
  /** The flight speed, in units per second. */
  readonly speed: number;
  /** Where the speed sits in its range, 0 to 1, on the logarithmic scale of Godot's indicator bar. */
  readonly speedFraction: number;
  /** How many times the wheel has changed the speed: a readout shows itself on each new count. */
  readonly speedChangeCount: number;
}

/** What the shell does to a canvas's freelook, and reads from it. */
export interface FreelookControl {
  /** Starts the toggle, or ends it. It does nothing where Godot has no freelook. */
  readonly toggle: () => void;
  readonly getState: () => FreelookState;
  /** Calls `listener` on each new state. Returns the unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** The two modifiers of `_update_freelook`, as a key or pointer event carries them. */
interface FreelookModifiers {
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * `draw_indicator_bar`'s fill for the speed (`node_3d_editor_plugin.cpp:3893-3899`). An empty
 * range has no scale, and Godot draws no bar for it.
 */
function speedFractionIn(speed: number, range: ZoomRange): number {
  const min = scaleFreelookSpeed(0, 1, range);
  const max = scaleFreelookSpeed(Infinity, 1, range);
  if (!(max > min)) return 0;
  return Math.log1p(speed - min) / Math.log1p(max - min);
}

export class Freelook {
  private isHeld = false;
  private readonly heldDirections = new Set<keyof FreelookKeys>();
  private modifiers: FreelookModifiers = { shiftKey: false, altKey: false };
  private state: FreelookState = {
    isToggled: false,
    speed: FREELOOK_BASE_SPEED,
    speedFraction: 0,
    speedChangeCount: 0,
  };
  private readonly listeners = new Set<() => void>();

  get isActive(): boolean {
    return this.isHeld || this.state.isToggled;
  }

  get isToggled(): boolean {
    return this.state.isToggled;
  }

  readonly getState = (): FreelookState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The right button went down or up. */
  setHeld(isHeld: boolean): void {
    this.isHeld = isHeld;
    this.releaseKeysWhenOff();
  }

  /** The canvas took or lost the pointer lock. */
  setToggled(isToggled: boolean): void {
    if (isToggled === this.state.isToggled) return;
    this.publish({ ...this.state, isToggled });
    this.releaseKeysWhenOff();
  }

  /** Returns whether `code` is a flight key, so the caller can keep it from the page. */
  pressKey(code: string): boolean {
    const direction = freelookDirectionOf(code);
    if (direction) this.heldDirections.add(direction);
    return direction !== undefined;
  }

  releaseKey(code: string): void {
    const direction = freelookDirectionOf(code);
    if (direction) this.heldDirections.delete(direction);
  }

  /** A key that is down when focus leaves sends no keyup, so the caller drops every key then. */
  releaseKeys(): void {
    this.heldDirections.clear();
    this.modifiers = { shiftKey: false, altKey: false };
  }

  /**
   * Read off each event, not tracked by the modifier's own keydown: Shift held before freelook
   * starts sends none.
   */
  readModifiers({ shiftKey, altKey }: FreelookModifiers): void {
    this.modifiers = { shiftKey, altKey };
  }

  /** `scale_freelook_speed`: one wheel event, with the clip planes that bound the speed. */
  scaleSpeed(scale: number, range: ZoomRange): void {
    const speed = scaleFreelookSpeed(this.state.speed, scale, range);
    this.publish({
      ...this.state,
      speed,
      speedFraction: speedFractionIn(speed, range),
      speedChangeCount: this.state.speedChangeCount + 1,
    });
  }

  /** One frame of flight. Returns `cursor` itself when freelook is off or no key is held. */
  fly(cursor: EditorCursor, deltaSeconds: number): EditorCursor {
    if (!this.isActive || this.heldDirections.size === 0) return cursor;
    const keys: FreelookKeys = { sprint: this.modifiers.shiftKey, slow: this.modifiers.altKey };
    for (const direction of this.heldDirections) keys[direction] = true;
    return freelookMoveCursor(cursor, keys, this.state.speed, deltaSeconds);
  }

  private releaseKeysWhenOff(): void {
    if (!this.isActive) this.releaseKeys();
  }

  private publish(state: FreelookState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
