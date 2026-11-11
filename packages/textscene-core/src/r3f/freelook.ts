/**
 * Freelook for one canvas: whether it is on, which flight keys are held, and the flight speed.
 * Godot keeps the same three per viewport (`freelook_active`, its input map and `freelook_speed`).
 * It is on while the right button is held, or from the toggle until the pointer lock ends.
 */
import { freelookDirectionOf } from './editorKeyBindings.js';
import { createExternalStore } from './hooks/createExternalStore.js';
import {
  FREELOOK_BASE_SPEED,
  freelookMoveCursor,
  scaleFreelookSpeed,
  zoomLimits,
  type EditorCursor,
  type FreelookKeys,
  type ZoomRange,
} from './godotEditorCursor.js';

/** What a toolbar and a speed readout show. A new object on each change, so a store can compare it. */
export interface FreelookState {
  readonly isToggled: boolean;
  /** False in orthographic view, where Godot has no freelook. */
  readonly isAvailable: boolean;
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
  const { min, max } = zoomLimits(range);
  if (!(max > min)) return 0;
  return Math.log1p(speed - min) / Math.log1p(max - min);
}

export class Freelook {
  private isHeld = false;
  /** By key code, not direction: W and the up arrow fly one way, and one can lift while the other holds. */
  private readonly heldKeyCodes = new Set<string>();
  private modifiers: FreelookModifiers = { shiftKey: false, altKey: false };
  private readonly store = createExternalStore<FreelookState>({
    isToggled: false,
    isAvailable: true,
    speed: FREELOOK_BASE_SPEED,
    speedFraction: 0,
    speedChangeCount: 0,
  });

  readonly getState = this.store.get;
  readonly subscribe = this.store.subscribe;

  get isActive(): boolean {
    return this.isHeld || this.isToggled;
  }

  /** Whether a frame of flight would move the camera: freelook is on and a flight key is held. */
  get isFlying(): boolean {
    return this.isActive && this.heldKeyCodes.size > 0;
  }

  get isToggled(): boolean {
    return this.getState().isToggled;
  }

  /** The right button went down or up. */
  setHeld(isHeld: boolean): void {
    this.isHeld = isHeld;
    this.releaseKeysWhenOff();
  }

  /** The canvas took or lost the pointer lock. */
  setToggled(isToggled: boolean): void {
    if (isToggled === this.isToggled) return;
    this.store.set({ ...this.getState(), isToggled });
    this.releaseKeysWhenOff();
  }

  /** The view went orthographic, or back to perspective. */
  setAvailable(isAvailable: boolean): void {
    if (isAvailable === this.getState().isAvailable) return;
    this.store.set({ ...this.getState(), isAvailable });
  }

  /** Returns whether `code` is a flight key, so the caller can keep it from the page. */
  pressKey(code: string): boolean {
    const isFlightKey = freelookDirectionOf(code) !== undefined;
    if (isFlightKey) this.heldKeyCodes.add(code);
    return isFlightKey;
  }

  releaseKey(code: string): void {
    this.heldKeyCodes.delete(code);
  }

  /** A key that is down when focus leaves sends no keyup, so the caller drops every key then. */
  releaseKeys(): void {
    this.heldKeyCodes.clear();
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
    const state = this.getState();
    const speed = scaleFreelookSpeed(state.speed, scale, range);
    this.store.set({
      ...state,
      speed,
      speedFraction: speedFractionIn(speed, range),
      speedChangeCount: state.speedChangeCount + 1,
    });
  }

  /** One frame of flight. Returns `cursor` itself when it is not flying. */
  fly(cursor: EditorCursor, deltaSeconds: number): EditorCursor {
    if (!this.isFlying) return cursor;
    const keys: FreelookKeys = { sprint: this.modifiers.shiftKey, slow: this.modifiers.altKey };
    for (const code of this.heldKeyCodes) {
      const direction = freelookDirectionOf(code);
      if (direction) keys[direction] = true;
    }
    return freelookMoveCursor(cursor, keys, this.getState().speed, deltaSeconds);
  }

  private releaseKeysWhenOff(): void {
    if (!this.isActive) this.releaseKeys();
  }
}
