import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { useViewportSelection } from './useViewportSelection';
import { clickWith, MIDDLE, perform, RIGHT, type Click, type Step } from './viewportClicks.testkit';
import { CanvasWorkspaceProvider, type CanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider, useSelectedNodePath, useSelection } from '../contexts/SelectionContext';

function setup(workspace: CanvasWorkspace = '3d') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CanvasWorkspaceProvider workspace={workspace}>
      <HierarchyProvider value={{ sceneGraph: null, panelId: 'p' }}>
        <SelectionProvider>{children}</SelectionProvider>
      </HierarchyProvider>
    </CanvasWorkspaceProvider>
  );
  return renderHook(
    () => ({ vp: useViewportSelection(), sel: useSelection(), selected: useSelectedNodePath() }),
    { wrapper }
  );
}

type View = ReturnType<typeof setup>;

/** Registers a fresh Object3D at `path`, as a node component does. */
function registerObjectAt({ result }: View, path: string): THREE.Object3D {
  const object = new THREE.Object3D();
  act(() => result.current.sel.registerNodeObject(path, object));
  return object;
}

function click({ result }: View, how: Click) {
  act(() => clickWith(result.current.vp.handlers, how));
}

describe('useViewportSelection', () => {
  it('selects the node a click lands on', () => {
    const view = setup();

    click(view, { on: registerObjectAt(view, 'Root/Mesh') });

    expect(view.result.current.selected).toBe('Root/Mesh');
  });

  it('clears the selection on a click on an object of no node, such as the empty-state grid', () => {
    const view = setup();
    click(view, { on: registerObjectAt(view, 'Root/Mesh') });

    click(view, { on: new THREE.Object3D() });

    expect(view.result.current.selected).toBeNull();
  });

  it('selects the node of a mesh nested under its wrapper', () => {
    const view = setup();
    const mesh = new THREE.Mesh();
    registerObjectAt(view, 'Root/MeshInstance3D').add(mesh);

    click(view, { on: mesh });

    expect(view.result.current.selected).toBe('Root/MeshInstance3D');
  });

  it('returns the same handlers object across renders, for one delegated root', () => {
    const { result, rerender } = setup();
    const first = result.current.vp.handlers;
    rerender();
    expect(result.current.vp.handlers).toBe(first);
  });
});

type Target = 'A' | 'B' | null;
type TableStep = Step extends infer S
  ? S extends { press: unknown }
    ? Omit<S, 'press'> & { press: Target }
    : S
  : never;

interface Row {
  readonly gesture: string;
  readonly steps: readonly TableStep[];
  /** The selection after the gesture, from 'Root/Selected'. */
  readonly selects: string | null;
  /** Godot's outcome and its line, or the issue that owns where the previewer differs. */
  readonly godot: string;
  readonly workspace?: CanvasWorkspace;
}

const KEPT = 'Root/Selected';
const A = 'Root/A';
const B = 'Root/B';
// The file is editor/scene/3d/node_3d_editor_plugin.cpp unless a row names another.
const ROWS: readonly Row[] = [
  {
    gesture: 'left click on a node',
    steps: [{ press: 'A' }, { release: 0 }],
    selects: A,
    godot: 'selects the press ray hit, :2107 and :2223',
  },
  {
    gesture: 'left click on a node that moves 8 px',
    steps: [{ press: 'A' }, { release: 8 }],
    selects: A,
    godot: 'a click up to 8 px, :2342',
  },
  {
    gesture: 'left click from a node released off it within 8 px',
    steps: [{ press: 'A' }, { release: 6 }],
    selects: A,
    godot: 'the press ray decides, :2107',
  },
  {
    gesture: 'left click on nothing',
    steps: [{ press: null }, { release: 0 }],
    selects: null,
    godot: 'a region of no size clears, :998-1003',
  },
  {
    gesture: 'left click on nothing that moves 8 px',
    steps: [{ press: null }, { release: 8 }],
    selects: null,
    godot: 'a region holding no node clears, :1105-1106',
  },
  {
    gesture: 'left click from nothing released on a node within 8 px',
    steps: [{ press: null }, { release: 6 }],
    selects: null,
    godot: 'a few pixels hold no whole node, so the region clears, :1105-1106',
  },
  {
    gesture: 'left drag of 20 px from a node',
    steps: [{ press: 'A' }, { move: 20 }, { release: 20 }],
    selects: KEPT,
    godot: 'a region select, :2344-2347, owned by #2163',
  },
  {
    gesture: 'left drag of 20 px from a node and back',
    steps: [{ press: 'A' }, { move: 20 }, { release: 0 }],
    selects: KEPT,
    godot: 'a region of no size clears, :998-1003, owned by #2163',
  },
  {
    gesture: 'left drag of 20 px from nothing',
    steps: [{ press: null }, { move: 20 }, { release: 20 }],
    selects: KEPT,
    godot: 'a region select, :2148-2151, owned by #2163',
  },
  {
    gesture: 'right click on a node',
    steps: [{ press: 'A', button: RIGHT }, { release: 0 }],
    selects: KEPT,
    godot: 'freelook, no select ray, :1893-1930',
  },
  {
    gesture: 'middle click on a node',
    steps: [{ press: 'A', button: MIDDLE }, { release: 0 }],
    selects: KEPT,
    godot: 'navigation, no select ray, :1938-1946',
  },
  {
    gesture: 'Alt+left click on a node',
    steps: [{ press: 'A', mods: { altKey: true } }, { release: 0 }],
    selects: KEPT,
    godot: 'orbits, as Emulate 3 Button Mouse binds it, :1986-1992',
  },
  {
    gesture: 'Alt+Shift+left click on nothing',
    steps: [{ press: null, mods: { altKey: true, shiftKey: true } }, { release: 0 }],
    selects: KEPT,
    godot: 'pans, :1986-1992',
  },
  {
    gesture: 'Shift+left click on nothing',
    steps: [{ press: null, mods: { shiftKey: true } }, { release: 0 }],
    selects: KEPT,
    godot: 'an appending region keeps the selection, :999-1001',
  },
  {
    gesture: 'Shift+left click on a node',
    steps: [{ press: 'A', mods: { shiftKey: true } }, { release: 0 }],
    selects: A,
    godot: 'adds the node to the selection, :830-839, owned by #2168',
  },
  {
    gesture: 'Ctrl+left click on a node',
    steps: [{ press: 'A', mods: { ctrlKey: true } }, { release: 0 }],
    selects: A,
    godot: 'Ctrl changes only the transform tool, :2110',
  },
  {
    gesture: 'Cmd+left click on a node',
    steps: [{ press: 'A', mods: { metaKey: true } }, { release: 0 }],
    selects: A,
    godot: 'Cmd changes only the transform tool, :2110',
  },
  {
    gesture: 'Ctrl+left click on nothing',
    steps: [{ press: null, mods: { ctrlKey: true } }, { release: 0 }],
    selects: null,
    godot: 'a region of no size clears, :998-1003',
  },
  {
    gesture: 'Alt+right click on a node',
    steps: [{ press: 'A', button: RIGHT, mods: { altKey: true } }, { release: 0 }],
    selects: KEPT,
    godot: 'opens the list of nodes under the pointer, :1912-1914, owned by #2169',
  },
  {
    gesture: 'left click released outside the canvas within 8 px',
    steps: [{ press: 'A' }, { move: 7 }, { release: 7 }],
    selects: A,
    godot: 'the viewport keeps the drag, so the release is a click, :2223',
  },
  {
    gesture: 'left press that the browser cancels',
    steps: [{ press: 'A' }, { cancel: true }],
    selects: KEPT,
    godot: 'no such event: the browser takes the gesture, so nothing picks',
  },
  {
    gesture: 'second touch lands on another node',
    steps: [{ press: 'A' }, { press: 'B', pointer: 'second' }, { release: 0 }],
    selects: A,
    godot: 'only the first touch is the mouse, core/input/input.cpp:849-859',
  },
  {
    gesture: 'second touch moves 30 px',
    steps: [
      { press: 'A' },
      { press: null, pointer: 'second' },
      { move: 30, pointer: 'second' },
      { release: 0 },
    ],
    selects: A,
    godot: 'only the first touch is the mouse, core/input/input.cpp:897',
  },
  {
    gesture: 'second touch lifts first',
    steps: [
      { press: 'A' },
      { press: 'B', pointer: 'second' },
      { release: 0, pointer: 'second' },
      { release: 0 },
    ],
    selects: A,
    godot: 'only the first touch is the mouse, core/input/input.cpp:857-859',
  },
  {
    gesture: 'second touch is cancelled',
    steps: [
      { press: 'A' },
      { press: null, pointer: 'second' },
      { cancel: true, pointer: 'second' },
      { release: 0 },
    ],
    selects: A,
    godot: 'only the first touch is the mouse, core/input/input.cpp:849-859',
  },
  {
    gesture: 'second touch released over a node after a pinch',
    steps: [
      { press: null },
      { press: 'B', pointer: 'second' },
      { move: 30 },
      { release: 30 },
      { release: 0, pointer: 'second' },
    ],
    selects: KEPT,
    godot: 'the first touch drags, a region select owned by #2163',
  },
  {
    gesture: 'left press while the right button holds freelook',
    steps: [{ press: null, button: RIGHT }, { chordLeft: 'down' }, { chordLeft: 'up' }, { release: 0 }],
    selects: KEPT,
    godot: 'the left branch casts its ray, :1978-2107, owned by #2170',
  },
  {
    gesture: 'left click on nothing in the 2D workspace',
    workspace: '2d',
    steps: [{ press: null }, { release: 0 }],
    selects: KEPT,
    godot: 'clears, canvas_item_editor_plugin.cpp:2533-2539, owned by #1819',
  },
];

describe("useViewportSelection against Godot's click gesture", () => {
  it.each(ROWS)('$gesture: $godot', ({ steps, selects, workspace }) => {
    const view = setup(workspace);
    const objects = { A: registerObjectAt(view, A), B: registerObjectAt(view, B) };
    click(view, { on: registerObjectAt(view, KEPT) });
    const resolved = steps.map((step) =>
      'press' in step ? { ...step, press: step.press && objects[step.press] } : step
    ) as Step[];

    act(() => perform(view.result.current.vp.handlers, resolved));

    expect(view.result.current.selected).toBe(selects);
  });
});
