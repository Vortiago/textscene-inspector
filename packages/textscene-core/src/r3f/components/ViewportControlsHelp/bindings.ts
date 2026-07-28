/**
 * The viewport's input bindings, as data.
 *
 * One source for the in-app help: the summary pill and the panel are built
 * from these rows, where previously the bindings lived only in
 * `docs/user-guide-web.md` and the app said nothing at all.
 *
 * The rows a resolver governs carry a `trigger`, and `bindings.test.ts` feeds
 * each one to the real resolver in `godotEditorCursor.ts` / `pointerGesture.ts`
 * and fails if the answer differs. That is what stops the table claiming
 * 'Orbit' for an input that actually pans. The prose in `docs/user-guide-web.md`
 * and the VS Code README is still maintained by hand and is NOT covered.
 *
 * The mouse and keyboard rows are Godot 4.6's own editor bindings. The
 * trackpad rows are Godot's pan-gesture bindings, minus the unmodified one:
 * the browser reports a two-finger scroll and a mouse wheel as the same event,
 * so the wheel's own Godot binding (zoom) keeps that slot. The touch rows have
 * no Godot equivalent at all — Godot's editor has no touch scheme.
 */
import type { NavMode, NavModifiers } from '../../godotEditorCursor.js';

/**
 * What a row's input resolves to, for the rows a resolver decides. `null` means
 * navigation deliberately declines it — plain left-drag, which selects.
 */
export type BindingOutcome = NavMode | null;

/** How to ask a resolver what a row's input does. */
export type BindingTrigger =
  | {
      readonly kind: 'drag';
      readonly button: number;
      readonly mods?: NavModifiers;
    }
  | { readonly kind: 'wheel'; readonly mods?: NavModifiers }
  | { readonly kind: 'touch'; readonly pointers: number };

/** One row: what the user does, and what the viewport does about it. */
export interface Binding {
  readonly input: string;
  readonly action: string;
  /**
   * Present when a resolver owns this row, so the test can hold the table to
   * the code. Absent for rows nothing resolves — the keyboard shortcuts, the
   * zoom HUD buttons, and the taps/pinches handled outside the mode resolvers.
   */
  readonly trigger?: BindingTrigger;
  readonly resolvesTo?: BindingOutcome;
}

/** Bindings for one input device, as the panel groups them. */
export interface BindingGroup {
  readonly device: string;
  readonly bindings: readonly Binding[];
}

/** What the help surface shows for one viewport mode. */
export interface ControlsHelp {
  /** The three bindings worth reading at a glance, for the pill. */
  readonly summary: string;
  readonly groups: readonly BindingGroup[];
}

const CONTROLS_3D: ControlsHelp = {
  summary: 'middle-drag = orbit · shift+wheel = pan · wheel = zoom',
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
        {
          input: 'W A S D Q E',
          action: 'Fly while right-dragging (Shift sprints)',
        },
      ],
    },
  ],
};

const CONTROLS_2D: ControlsHelp = {
  summary: 'drag = pan · wheel = zoom · pinch = zoom',
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
