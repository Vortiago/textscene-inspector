/**
 * The viewport's input bindings, as data.
 *
 * One source of truth for the in-app help, so the panel, the summary pill and
 * the user guides cannot drift apart the way the previous arrangement did —
 * the bindings lived only in `docs/user-guide-web.md`, and the app said
 * nothing at all.
 *
 * The mouse and keyboard rows are Godot 4.6's own editor bindings. The
 * trackpad rows are Godot's pan-gesture bindings, minus the unmodified one:
 * the browser reports a two-finger scroll and a mouse wheel as the same event,
 * so the wheel's own Godot binding (zoom) keeps that slot. The touch rows have
 * no Godot equivalent at all — Godot's editor has no touch scheme.
 */

/** One row: what the user does, and what the viewport does about it. */
export interface Binding {
  readonly input: string;
  readonly action: string;
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
        { input: 'Left-click', action: 'Select' },
        { input: 'Middle-drag', action: 'Orbit' },
        { input: 'Shift + middle-drag', action: 'Pan' },
        { input: 'Ctrl + middle-drag', action: 'Zoom' },
        { input: 'Wheel', action: 'Zoom' },
        { input: 'Shift + wheel', action: 'Pan' },
        { input: 'Right-drag', action: 'Freelook — turn the camera in place' },
        { input: 'Alt + left-drag', action: 'Orbit, for a mouse with no middle button' },
        { input: 'Alt + Shift + left-drag', action: 'Pan' },
      ],
    },
    {
      device: 'Trackpad',
      bindings: [
        { input: 'Two-finger scroll', action: 'Zoom' },
        { input: 'Shift + two-finger scroll', action: 'Pan' },
        { input: 'Pinch', action: 'Zoom' },
      ],
    },
    {
      device: 'Touch',
      bindings: [
        { input: 'Tap', action: 'Select' },
        { input: 'One-finger drag', action: 'Orbit' },
        { input: 'Two-finger drag', action: 'Pan' },
        { input: 'Pinch', action: 'Zoom' },
      ],
    },
    {
      device: 'Keyboard',
      bindings: [
        { input: 'F', action: 'Frame the selection, or the whole scene' },
        { input: 'Numpad 1 / 3 / 7', action: 'Front / right / top view; Ctrl for the opposite' },
        { input: 'Numpad 5', action: 'Perspective ⇄ orthographic' },
        { input: 'W A S D Q E', action: 'Fly while right-dragging (Shift sprints)' },
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
        { input: '− / + / Fit', action: 'Zoom out, in, or fit the viewport rectangle' },
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
