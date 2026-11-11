/**
 * The viewport's input bindings as data, for the help pill and panel. A row
 * with a `trigger` is held to its resolver by `bindings.test.ts`. This panel is
 * the only list of the bindings: the docs point to it and repeat none.
 */
import type { FreelookDirection } from '../../editorKeyBindings.js';
import type { NavMode, NavModifiers, Projection } from '../../godotEditorCursor.js';

/**
 * What a row's input resolves to: a navigation mode, or the direction a flight key
 * flies in. `null` means navigation declines it, as for a plain left-drag, which selects.
 */
export type BindingOutcome = NavMode | FreelookDirection | null;

/** How to ask a resolver what a row's input does. */
type BindingTrigger =
  | {
      readonly kind: 'drag';
      readonly button: number;
      readonly mods?: NavModifiers;
      readonly projection?: Projection;
    }
  | { readonly kind: 'flightKeys'; readonly codes: readonly string[] }
  | { readonly kind: 'wheel'; readonly mods?: NavModifiers }
  | { readonly kind: 'touch'; readonly pointers: number };

/** One row: what the user does, and what the viewport does about it. */
export interface Binding {
  readonly input: string;
  readonly action: string;
  /**
   * Present when a resolver owns the row. Absent for the view shortcuts, the freelook
   * toggle and modifiers, the zoom HUD buttons, and the taps and pinches outside the resolvers.
   */
  readonly trigger?: BindingTrigger;
  readonly resolvesTo?: BindingOutcome;
}

/** Bindings for one input device, as the panel groups them. */
interface BindingGroup {
  readonly device: string;
  readonly bindings: readonly Binding[];
}

/** What the help surface shows for one viewport mode. */
interface ControlsHelp {
  /** The three bindings worth reading at a glance, for the pill. */
  readonly summary: string;
  /** The pill on a touch screen, from the Touch group, since it has no wheel or middle button. */
  readonly touchSummary: string;
  readonly groups: readonly BindingGroup[];
}

// In both tables the mouse and keyboard rows are Godot 4.6's editor bindings, and the trackpad
// rows are its pan-gesture bindings minus the unmodified one: a browser reports a two-finger
// scroll as a wheel event, so the wheel's zoom keeps that slot. The touch rows, and the arrow
// keys and Space of the Freelook rows, are the previewer's own (ADR-0029).
const CONTROLS_3D: ControlsHelp = {
  summary: 'middle-drag = orbit · shift+wheel = pan · wheel = zoom',
  touchSummary: 'drag = orbit · two fingers = pan · pinch = zoom',
  groups: [
    {
      device: 'Mouse',
      bindings: [
        {
          input: 'Left-click',
          action: 'Select',
          trigger: { kind: 'drag', button: 0 },
          resolvesTo: null,
        },
        {
          input: 'Middle-drag',
          action: 'Orbit',
          trigger: { kind: 'drag', button: 1 },
          resolvesTo: 'orbit',
        },
        {
          input: 'Shift + middle-drag',
          action: 'Pan',
          trigger: { kind: 'drag', button: 1, mods: { shiftKey: true } },
          resolvesTo: 'pan',
        },
        {
          input: 'Ctrl + middle-drag',
          action: 'Zoom',
          trigger: { kind: 'drag', button: 1, mods: { ctrlKey: true } },
          resolvesTo: 'zoom',
        },
        {
          input: 'Wheel',
          action: 'Zoom',
          trigger: { kind: 'wheel' },
          resolvesTo: 'zoom',
        },
        {
          input: 'Shift + wheel',
          action: 'Pan',
          trigger: { kind: 'wheel', mods: { shiftKey: true } },
          resolvesTo: 'pan',
        },
        {
          input: 'Right-drag',
          action: 'Freelook — turn the camera in place',
          trigger: { kind: 'drag', button: 2 },
          resolvesTo: 'freelook',
        },
        {
          input: 'Right-drag in orthographic view',
          action: 'Pan',
          trigger: { kind: 'drag', button: 2, projection: 'orthographic' },
          resolvesTo: 'pan',
        },
        {
          input: 'Alt + left-drag',
          action: 'Orbit, for a mouse with no middle button',
          trigger: { kind: 'drag', button: 0, mods: { altKey: true } },
          resolvesTo: 'orbit',
        },
        {
          input: 'Alt + Shift + left-drag',
          action: 'Pan',
          trigger: {
            kind: 'drag',
            button: 0,
            mods: { altKey: true, shiftKey: true },
          },
          resolvesTo: 'pan',
        },
      ],
    },
    {
      device: 'Trackpad',
      bindings: [
        {
          input: 'Two-finger scroll',
          action: 'Zoom',
          trigger: { kind: 'wheel' },
          resolvesTo: 'zoom',
        },
        {
          input: 'Shift + two-finger scroll',
          action: 'Pan',
          trigger: { kind: 'wheel', mods: { shiftKey: true } },
          resolvesTo: 'pan',
        },
        {
          input: 'Pinch',
          action: 'Zoom',
          trigger: { kind: 'wheel', mods: { ctrlKey: true } },
          resolvesTo: 'zoom',
        },
      ],
    },
    {
      device: 'Touch',
      bindings: [
        { input: 'Tap', action: 'Select' },
        {
          input: 'One-finger drag',
          action: 'Orbit',
          trigger: { kind: 'touch', pointers: 1 },
          resolvesTo: 'orbit',
        },
        {
          input: 'Two-finger drag',
          action: 'Pan',
          trigger: { kind: 'touch', pointers: 2 },
          resolvesTo: 'pan',
        },
        { input: 'Pinch', action: 'Zoom' },
      ],
    },
    {
      device: 'Keyboard',
      bindings: [
        { input: 'F', action: 'Frame the selection — also lets you zoom closer in' },
        {
          input: 'Numpad 1 / 3 / 7',
          action: 'Front / right / top view; Ctrl for the opposite',
        },
        { input: 'Numpad 5', action: 'Perspective ⇄ orthographic' },
      ],
    },
    {
      device: 'Freelook',
      bindings: [
        {
          input: 'Shift + F',
          action: 'Freelook on or off: the mouse looks around, and Escape leaves',
        },
        { input: 'Right-drag', action: 'Freelook while the button is held' },
        {
          input: 'W or ↑',
          action: 'Fly forward',
          trigger: { kind: 'flightKeys', codes: ['KeyW', 'ArrowUp'] },
          resolvesTo: 'forward',
        },
        {
          input: 'S or ↓',
          action: 'Fly back',
          trigger: { kind: 'flightKeys', codes: ['KeyS', 'ArrowDown'] },
          resolvesTo: 'back',
        },
        {
          input: 'A or ←',
          action: 'Fly left',
          trigger: { kind: 'flightKeys', codes: ['KeyA', 'ArrowLeft'] },
          resolvesTo: 'left',
        },
        {
          input: 'D or →',
          action: 'Fly right',
          trigger: { kind: 'flightKeys', codes: ['KeyD', 'ArrowRight'] },
          resolvesTo: 'right',
        },
        {
          input: 'E or Space',
          action: 'Fly up',
          trigger: { kind: 'flightKeys', codes: ['KeyE', 'Space'] },
          resolvesTo: 'up',
        },
        {
          input: 'Q',
          action: 'Fly down',
          trigger: { kind: 'flightKeys', codes: ['KeyQ'] },
          resolvesTo: 'down',
        },
        { input: 'Shift / Alt', action: 'Fly 3 times faster / 3 times slower' },
        { input: 'Wheel', action: 'Change the flight speed' },
      ],
    },
  ],
};

const CONTROLS_2D: ControlsHelp = {
  summary: 'drag = pan · wheel = zoom · pinch = zoom',
  touchSummary: 'drag = pan · pinch = zoom',
  groups: [
    {
      device: 'Mouse',
      bindings: [
        { input: 'Drag', action: 'Pan' },
        { input: 'Wheel', action: 'Zoom, anchored to the cursor' },
        {
          input: '− / + / Fit',
          action: 'Zoom out, in, or fit the viewport rectangle',
        },
      ],
    },
    {
      device: 'Trackpad',
      bindings: [
        { input: 'Two-finger scroll', action: 'Zoom' },
        { input: 'Pinch', action: 'Zoom' },
      ],
    },
    {
      device: 'Touch',
      bindings: [
        { input: 'One-finger drag', action: 'Pan' },
        { input: 'Two-finger drag', action: 'Pan' },
        { input: 'Pinch', action: 'Zoom' },
      ],
    },
  ],
};

/** The bindings that apply in a viewport mode. */
export function controlsFor(mode: '2D' | '3D'): ControlsHelp {
  return mode === '2D' ? CONTROLS_2D : CONTROLS_3D;
}
