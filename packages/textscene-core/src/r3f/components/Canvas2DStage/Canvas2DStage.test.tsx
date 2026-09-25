/**
 * Canvas2DStage behavior: frame chrome (dimension badge), the zoom
 * HUD (in/out/fit + clamping), wheel-to-zoom, and pointer-capture
 * drag-to-pan. The native Control canvas mounts inside `<World2DCanvas>`,
 * which has its own suites; this one only covers the stage chrome around it.
 */
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, type RenderResult } from '@testing-library/react';

/**
 * Renders of the stubbed world canvas. A delta of 0 across an event shows the
 * event committed no state update. It is never reset, so compare deltas.
 */
const worldRenders = vi.hoisted(() => ({ count: 0 }));

// The 2D-world canvas needs WebGL, so a stub records the pan and zoom it receives.
vi.mock('./World2DCanvas', () => ({
  World2DCanvas: ({
    pan,
    zoom,
    nodes,
  }: {
    pan: { x: number; y: number };
    zoom: number;
    nodes: readonly unknown[];
  }) => {
    worldRenders.count += 1;
    return (
      <div
        data-testid="world-canvas-stub"
        data-pan={`${pan.x},${pan.y}`}
        data-zoom={zoom}
        data-node-count={nodes.length}
      />
    );
  },
}));

/**
 * The project viewport the stage reads, Godot's default until a test moves it. A move
 * stands in for `project.godot` resolving after the scene opened.
 */
const projectViewport = vi.hoisted(() => ({ size: { width: 1152, height: 648 } }));

vi.mock('../../contexts/ProjectSettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/ProjectSettingsContext')>();
  return {
    ...actual,
    useProjectSettings: () => ({
      settings: null,
      themeScale: 1,
      viewportSize: projectViewport.size,
    }),
  };
});

import { Canvas2DStage } from './Canvas2DStage';
import {
  CameraControlProvider,
  useCameraControl,
} from '../../contexts/CameraControlContext';
import { FIT_ON_OPEN_2D_STORAGE_KEY } from './viewport2d';
import type { TscnNode } from '../../../parser/types';

/** happy-dom reports a zero-sized rect, and `fit()` returns early on one. */
function sizeEveryElement(width: number, height: number) {
  return vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      width,
      height,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
    } as DOMRect);
}

afterEach(() => {
  vi.restoreAllMocks();
  // Read once at mount, so a leaked value silently changes the next test's
  // opening view.
  window.localStorage.removeItem(FIT_ON_OPEN_2D_STORAGE_KEY);
  projectViewport.size = { width: 1152, height: 648 };
});

const SCENE_PATH = 'res://level.tscn';

function makeNode(name: string): TscnNode {
  return { name, type: 'Control', properties: {}, children: [] } as unknown as TscnNode;
}

function renderStage(nodes: TscnNode[] = []) {
  const utils = render(
    <Canvas2DStage
      nodes={nodes}
      internalResources={[]}
      externalResources={[]}
      scenePath={SCENE_PATH}
    />
  );
  const stage = screen.getByLabelText('2D canvas');
  // The frame is the dimension badge's parent: module-class hashing makes a
  // class-name query brittle.
  const frame = screen.getByText('1152 × 648').parentElement as HTMLElement;
  return { ...utils, stage, frame };
}

function zoomLabel(): string {
  return screen.getByText(/%$/).textContent ?? '';
}

/**
 * happy-dom drops `clientX`/`clientY` from a `WheelEvent`, which makes the zoom
 * anchor `NaN`. They are defined on the instance instead.
 */
function wheelAt(
  target: Element,
  init: { deltaY: number; clientX?: number; clientY?: number }
): void {
  const event = new WheelEvent('wheel', {
    deltaY: init.deltaY,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'clientX', { value: init.clientX ?? 0 });
  Object.defineProperty(event, 'clientY', { value: init.clientY ?? 0 });
  fireEvent(target, event);
}

/** One finger's lifecycle step, as the stage's pointer handlers see it. */
function touch(
  target: Element,
  phase: 'down' | 'move' | 'up',
  pointerId: number,
  clientX: number,
  clientY: number
): void {
  const init = { pointerType: 'touch', pointerId, clientX, clientY, isPrimary: pointerId === 1 };
  if (phase === 'down') fireEvent.pointerDown(target, init);
  else if (phase === 'move') fireEvent.pointerMove(target, init);
  else fireEvent.pointerUp(target, init);
}

/** A button that drives the context the Cameras panel uses: frame (300, 200) at zoom 2. */
function FrameProbe() {
  const cam = useCameraControl();
  return (
    <button
      type="button"
      onClick={() => cam.requestFrame2D({ center: { x: 300, y: 200 }, zoom: 2 })}
    >
      frame camera
    </button>
  );
}

describe('<Canvas2DStage>', () => {
  it('renders the stage chrome: dimension badge and zoom HUD at 100%', () => {
    renderStage();
    expect(screen.getByText('1152 × 648')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Canvas zoom' })).toBeTruthy();
    expect(zoomLabel()).toBe('100%');
  });

  it('mounts the 2D world canvas with the stage pan/zoom kept in sync', () => {
    renderStage([makeNode('A')]);
    const world = screen.getByTestId('world-canvas-stub');
    expect(world.getAttribute('data-node-count')).toBe('1');
    expect(world.getAttribute('data-zoom')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByTestId('world-canvas-stub').getAttribute('data-zoom')).toBe('1.2');
  });

  it('zooms in and out around the centre via the HUD buttons', () => {
    renderStage();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomLabel()).toBe('120%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoomLabel()).toBe('100%');
  });

  it('clamps HUD zoom to the 400% max and 10% min', () => {
    renderStage();
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    for (let i = 0; i < 20; i++) fireEvent.click(zoomIn);
    expect(zoomLabel()).toBe('400%');

    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
    for (let i = 0; i < 40; i++) fireEvent.click(zoomOut);
    expect(zoomLabel()).toBe('10%');
  });

  it('wheel-up zooms in, wheel-down zooms back out (native non-passive listener)', () => {
    const { stage } = renderStage();
    wheelAt(stage, { deltaY: -100 });
    expect(zoomLabel()).toBe('110%');
    wheelAt(stage, { deltaY: 100 });
    expect(zoomLabel()).toBe('100%');
  });

  it('anchors wheel zoom to the cursor: what is under it stays under it', () => {
    // Opening pinned (fit off) so the arithmetic is about the anchor alone:
    // world origin at the stage origin, one canvas pixel per screen pixel.
    window.localStorage.setItem(FIT_ON_OPEN_2D_STORAGE_KEY, 'false');
    sizeEveryElement(800, 600);
    const { stage, frame } = renderStage();
    expect(frame.style.transform).toBe('translate(0px, 0px) scale(1)');

    // The stage origin is already the frame origin, so it is a fixed point:
    // zooming about it scales without translating.
    wheelAt(stage, { deltaY: -100, clientX: 0, clientY: 0 });
    expect(frame.style.transform).toBe('translate(0px, 0px) scale(1.1)');

    // Anywhere else the frame must slide to keep that point put. Back at
    // scale 1, world (400, 300) sits under the cursor; at 1.1 it would drift
    // to (440, 330) unless the pan takes up the 40/30 difference.
    wheelAt(stage, { deltaY: 100, clientX: 0, clientY: 0 });
    wheelAt(stage, { deltaY: -100, clientX: 400, clientY: 300 });
    const [, x, y, scale] =
      /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(frame.style.transform) ?? [];
    expect(Number(scale)).toBeCloseTo(1.1, 9);
    expect(400 * Number(scale) + Number(x)).toBeCloseTo(400, 9);
    expect(300 * Number(scale) + Number(y)).toBeCloseTo(300, 9);
  });

  it('drag-to-pan translates the canvas frame by the pointer delta', () => {
    const { stage, frame } = renderStage();
    expect(frame.style.transform).toBe('translate(0px, 0px) scale(1)');

    fireEvent.pointerDown(stage, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 60, clientY: 40, pointerId: 1 });
    expect(frame.style.transform).toBe('translate(50px, 30px) scale(1)');

    fireEvent.pointerUp(stage, { clientX: 60, clientY: 40, pointerId: 1 });
    // After release, further moves no longer pan.
    fireEvent.pointerMove(stage, { clientX: 200, clientY: 200, pointerId: 1 });
    expect(frame.style.transform).toBe('translate(50px, 30px) scale(1)');
  });

  it('pans on a one-finger drag, the same as a mouse drag', () => {
    const { stage, frame } = renderStage();
    touch(stage, 'down', 1, 10, 10);
    touch(stage, 'move', 1, 10, 10);
    touch(stage, 'move', 1, 60, 40);
    expect(frame.style.transform).toBe('translate(50px, 30px) scale(1)');

    touch(stage, 'up', 1, 60, 40);
    touch(stage, 'move', 1, 200, 200);
    expect(frame.style.transform).toBe('translate(50px, 30px) scale(1)');
  });

  it('zooms on a pinch, without the fingers’ midpoint moving', () => {
    sizeEveryElement(800, 600);
    const { stage } = renderStage();
    touch(stage, 'down', 1, 380, 300);
    touch(stage, 'down', 2, 420, 300);
    // Seed the gesture origin before anything moves.
    touch(stage, 'move', 1, 380, 300);
    touch(stage, 'move', 2, 420, 300);

    // Spread from 40px apart to 160px: four times the zoom, clamped at
    // ZOOM_MAX = 4 from an opening fit below 1.
    touch(stage, 'move', 1, 320, 300);
    touch(stage, 'move', 2, 480, 300);
    const spread = Number.parseFloat(zoomLabel());

    touch(stage, 'move', 1, 380, 300);
    touch(stage, 'move', 2, 420, 300);
    const pinched = Number.parseFloat(zoomLabel());

    expect(spread).toBeGreaterThan(pinched);
  });

  it('leaves the zoom where it was after a pan whose pinch nets out', () => {
    // Both fingers slide 200px left, and between the two per-pointer moves the
    // span reads 300px instead of 100px. Accumulated, that 3x clamps at
    // ZOOM_MAX = 4, and the 1/3 back leaves the stage at 133%.
    window.localStorage.setItem(FIT_ON_OPEN_2D_STORAGE_KEY, 'false');
    sizeEveryElement(800, 600);
    const { stage } = renderStage();
    wheelAt(stage, { deltaY: -400 });
    wheelAt(stage, { deltaY: -400 });
    const before = zoomLabel();

    touch(stage, 'down', 1, 100, 300);
    touch(stage, 'down', 2, 200, 300);
    touch(stage, 'move', 1, 100, 300);
    touch(stage, 'move', 2, 200, 300);
    touch(stage, 'move', 1, -100, 300);
    touch(stage, 'move', 2, 0, 300);

    expect(zoomLabel()).toBe(before);
  });

  it('re-seeds the gesture when a finger lands or leaves, so the view never jumps', () => {
    const { stage, frame } = renderStage();
    touch(stage, 'down', 1, 100, 100);
    touch(stage, 'move', 1, 100, 100);
    touch(stage, 'move', 1, 150, 100);
    const oneFinger = frame.style.transform;
    expect(oneFinger).toBe('translate(50px, 0px) scale(1)');

    // A second finger arriving moves the midpoint 50px in one step. Without a
    // re-seed that delta would be applied as a pan.
    touch(stage, 'down', 2, 250, 100);
    touch(stage, 'move', 2, 250, 100);
    expect(frame.style.transform).toBe(oneFinger);

    // And the same on the way out.
    touch(stage, 'up', 2, 250, 100);
    touch(stage, 'move', 1, 150, 100);
    expect(frame.style.transform).toBe(oneFinger);
  });

  it('ignores a third finger rather than guessing at a gesture', () => {
    const { stage, frame } = renderStage();
    touch(stage, 'down', 1, 100, 100);
    touch(stage, 'down', 2, 200, 100);
    touch(stage, 'down', 3, 300, 100);
    touch(stage, 'move', 1, 100, 100);
    touch(stage, 'move', 1, 160, 140);
    touch(stage, 'move', 2, 260, 140);
    touch(stage, 'move', 3, 360, 140);
    expect(frame.style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('ignores a zero-delta two-finger move rather than committing a no-op update', () => {
    const { stage, frame } = renderStage();
    touch(stage, 'down', 1, 100, 300);
    touch(stage, 'down', 2, 200, 300);
    touch(stage, 'move', 1, 100, 300);
    touch(stage, 'move', 2, 200, 300);
    const settled = frame.style.transform;
    const renders = worldRenders.count;

    // One pointermove per pointer: a two-finger gesture delivers events in which
    // nothing moved, and a re-render re-renders the Control overlay too.
    touch(stage, 'move', 1, 100, 300);
    touch(stage, 'move', 2, 200, 300);

    expect(frame.style.transform).toBe(settled);
    expect(worldRenders.count - renders).toBe(0);
  });

  it('ignores a zero-delta mouse move rather than committing a no-op update', () => {
    const { stage, frame } = renderStage();
    fireEvent.pointerDown(stage, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 60, clientY: 40, pointerId: 1 });
    const settled = frame.style.transform;
    const renders = worldRenders.count;

    fireEvent.pointerMove(stage, { clientX: 60, clientY: 40, pointerId: 1 });

    expect(frame.style.transform).toBe(settled);
    expect(worldRenders.count - renders).toBe(0);
  });

  it('drops the gesture on window blur, so the next drag pans from its own start', () => {
    const { stage, frame } = renderStage();
    touch(stage, 'down', 1, 100, 100);
    touch(stage, 'down', 2, 200, 100);
    touch(stage, 'move', 1, 100, 100);
    touch(stage, 'move', 2, 200, 100);

    // Alt-tab mid-gesture: neither finger ever delivers a pointerup.
    fireEvent.blur(window);

    touch(stage, 'down', 1, 300, 100);
    touch(stage, 'move', 1, 300, 100);
    touch(stage, 'move', 1, 350, 100);
    // A stale second finger at (200, 100) would halve this pan and pinch the
    // stage to 150% on the side.
    expect(frame.style.transform).toBe('translate(50px, 0px) scale(1)');
    expect(zoomLabel()).toBe('100%');
  });

  it('drops a finger whose pointer capture was lost, without waiting for a pointerup', () => {
    const { stage, frame } = renderStage();
    touch(stage, 'down', 1, 100, 100);
    touch(stage, 'down', 2, 200, 100);
    fireEvent.lostPointerCapture(stage, { pointerType: 'touch', pointerId: 2 });

    touch(stage, 'move', 1, 100, 100);
    touch(stage, 'move', 1, 150, 100);
    expect(frame.style.transform).toBe('translate(50px, 0px) scale(1)');
  });

  it('ends a mouse drag whose pointer capture was lost mid-drag', () => {
    const { stage, frame } = renderStage();
    fireEvent.pointerDown(stage, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 60, clientY: 40, pointerId: 1 });
    expect(frame.style.transform).toBe('translate(50px, 30px) scale(1)');

    fireEvent.lostPointerCapture(stage, { pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 200, clientY: 200, pointerId: 1 });
    expect(frame.style.transform).toBe('translate(50px, 30px) scale(1)');
  });

  it('frames a 2D camera view on request: centers the view point at the requested zoom', () => {
    render(
      <CameraControlProvider>
        <FrameProbe />
        <Canvas2DStage
          nodes={[]}
          internalResources={[]}
          externalResources={[]}
          scenePath={SCENE_PATH}
        />
      </CameraControlProvider>
    );
    const stage = screen.getByLabelText('2D canvas');
    // happy-dom rects are 0×0, so the stage gets a real size for the centring.
    stage.getBoundingClientRect = () =>
      ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0 }) as DOMRect;

    fireEvent.click(screen.getByRole('button', { name: 'frame camera' }));

    // pan = stage/2 − center·zoom → (400 − 600, 300 − 400) = (−200, −100).
    const frame = screen.getByText('1152 × 648').parentElement as HTMLElement;
    expect(frame.style.transform).toBe('translate(-200px, -100px) scale(2)');
    expect(zoomLabel()).toBe('200%');
  });

  it('ignores pointer move when no drag is active, and non-primary buttons', () => {
    const { stage, frame } = renderStage();
    fireEvent.pointerMove(stage, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(frame.style.transform).toBe('translate(0px, 0px) scale(1)');

    fireEvent.pointerDown(stage, { button: 2, clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(frame.style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('draws origin axes at world (0, 0) that track the stage pan', () => {
    const { stage } = renderStage();
    const axisX = () => screen.getByTestId('origin-axis-x');
    const axisY = () => screen.getByTestId('origin-axis-y');

    // Initial pan is (0, 0): the axes cross at the stage's top-left corner.
    expect(axisX().style.top).toBe('0px');
    expect(axisY().style.left).toBe('0px');

    // A drag pans the stage; the axes follow so they stay glued to world origin.
    fireEvent.pointerDown(stage, { button: 0, clientX: 10, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 45, clientY: 80, pointerId: 1 });
    expect(axisX().style.top).toBe('60px'); // pan.y = 80 − 20
    expect(axisY().style.left).toBe('35px'); // pan.x = 45 − 10
  });

  it('fits the viewport rectangle to the stage when a scene opens', () => {
    sizeEveryElement(800, 600);
    const { frame } = renderStage();
    // zoom = min((800−56)/1152, (600−56)/648) = 0.6458…, centred in the stage.
    expect(zoomLabel()).toBe('65%');
    expect(frame.style.transform).toMatch(/scale\(0\.645/);
  });

  it('opens at zoom 1 with world origin at the stage origin when fit-on-open is off', () => {
    // The pinned opening view a parity capture clips to: one canvas pixel per
    // screen pixel, at the same place every run, so the frame is directly
    // comparable with a Godot render of the same scene.
    window.localStorage.setItem(FIT_ON_OPEN_2D_STORAGE_KEY, 'false');
    sizeEveryElement(1600, 900);
    const { frame } = renderStage();
    expect(zoomLabel()).toBe('100%');
    expect(frame.style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('renders the capture frame regardless of scene content — the parity-capture contract', () => {
    render(
      <Canvas2DStage
        nodes={[makeNode('A')]}
        internalResources={[]}
        externalResources={[]}
        scenePath={SCENE_PATH}
      />
    );
    // The capture frame is the parity-capture contract
    // (`scripts/godot-ref/capture-ours.mjs`). Nothing draws into it.
    expect(screen.getByTestId('canvas-2d-capture-frame')).toBeTruthy();
  });

  it('Fit recenters the frame inside the stage bounds with the margin-fitted zoom', () => {
    const { stage, frame } = renderStage();
    // happy-dom reports a zero rect (fit() on mount early-returns); give the
    // stage a real one so the fit math has something to work with.
    stage.getBoundingClientRect = () =>
      ({ width: 1208, height: 704, left: 0, top: 0, right: 1208, bottom: 704, x: 0, y: 0 }) as DOMRect;

    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    // zoom = min((1208-56)/1152, (704-56)/648) = 1 → centred at (28, 28).
    expect(zoomLabel()).toBe('100%');
    expect(frame.style.transform).toBe('translate(28px, 28px) scale(1)');
  });
});

describe('<Canvas2DStage> fit on open: load time', () => {
  /** The stage as the viewport area mounts it, with the props a rerender changes. */
  function stageAt(scenePath: string, nodes: TscnNode[] = []) {
    return (
      <CameraControlProvider>
        <FrameProbe />
        <Canvas2DStage
          nodes={nodes}
          internalResources={[]}
          externalResources={[]}
          scenePath={scenePath}
        />
      </CameraControlProvider>
    );
  }

  /** The same tree in the 3D workspace: the stage unmounts and the provider stays. */
  function withoutStage() {
    return (
      <CameraControlProvider>
        <FrameProbe />
      </CameraControlProvider>
    );
  }

  /**
   * The Cameras panel's look-through: one click requests a framing and switches to 2D,
   * so the stage mounts in the render that carries the new request.
   */
  function LookThrough2DHost() {
    const cam = useCameraControl();
    const [is2D, setIs2D] = useState(false);
    function lookThrough() {
      cam.requestFrame2D({ center: { x: 300, y: 200 }, zoom: 2 });
      setIs2D(true);
    }
    return (
      <>
        <button type="button" onClick={lookThrough}>
          look through
        </button>
        {is2D && (
          <Canvas2DStage
            nodes={[]}
            internalResources={[]}
            externalResources={[]}
            scenePath={SCENE_PATH}
          />
        )}
      </>
    );
  }

  /** `project.godot` resolves after the scene opened, and its provider re-renders. */
  function projectViewportResolves(rerender: RenderResult['rerender'], scenePath = SCENE_PATH) {
    projectViewport.size = { width: 744, height: 544 };
    rerender(stageAt(scenePath));
  }

  /** With the stage at 800x600, a 744x544 viewport fits at zoom 1, 28 px in on each side. */
  const FITTED_LATE = 'translate(28px, 28px) scale(1)';

  const frameTransform = () => screen.getByTestId('canvas-2d-frame').style.transform;
  const stageElement = () => screen.getByLabelText('2D canvas');

  function dragPan() {
    fireEvent.pointerDown(stageElement(), { button: 0, clientX: 10, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(stageElement(), { clientX: 45, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(stageElement(), { clientX: 45, clientY: 80, pointerId: 1 });
  }

  it('refits to a project viewport that resolves after the scene opens', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));

    projectViewportResolves(rerender);

    expect(frameTransform()).toBe(FITTED_LATE);
  });

  it('keeps a drag pan made before the project viewport resolves', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    dragPan();
    const panned = frameTransform();

    projectViewportResolves(rerender);

    expect(frameTransform()).toBe(panned);
  });

  it('keeps a wheel zoom made before the project viewport resolves', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    wheelAt(stageElement(), { deltaY: -100, clientX: 400, clientY: 300 });
    const zoomed = frameTransform();

    projectViewportResolves(rerender);

    expect(frameTransform()).toBe(zoomed);
  });

  it('keeps a zoom button click made before the project viewport resolves', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const zoomed = frameTransform();

    projectViewportResolves(rerender);

    expect(frameTransform()).toBe(zoomed);
  });

  it('keeps a one-finger pan made before the project viewport resolves', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    touch(stageElement(), 'down', 1, 10, 10);
    touch(stageElement(), 'move', 1, 10, 10);
    touch(stageElement(), 'move', 1, 60, 40);
    touch(stageElement(), 'up', 1, 60, 40);
    const panned = frameTransform();

    projectViewportResolves(rerender);

    expect(frameTransform()).toBe(panned);
  });

  it('keeps a pinch zoom made before the project viewport resolves', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    touch(stageElement(), 'down', 1, 380, 300);
    touch(stageElement(), 'down', 2, 420, 300);
    touch(stageElement(), 'move', 1, 380, 300);
    touch(stageElement(), 'move', 2, 420, 300);
    touch(stageElement(), 'move', 1, 320, 300);
    touch(stageElement(), 'move', 2, 480, 300);
    touch(stageElement(), 'up', 1, 320, 300);
    touch(stageElement(), 'up', 2, 480, 300);
    const pinched = frameTransform();

    projectViewportResolves(rerender);

    expect(frameTransform()).toBe(pinched);
  });

  it('keeps a Camera2D framing made before the project viewport resolves', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    fireEvent.click(screen.getByRole('button', { name: 'frame camera' }));
    // pan = stage/2 − center·zoom → (400 − 600, 300 − 400).
    expect(frameTransform()).toBe('translate(-200px, -100px) scale(2)');

    projectViewportResolves(rerender);

    expect(frameTransform()).toBe('translate(-200px, -100px) scale(2)');
  });

  it('keeps the scene open across an edit, so a later project viewport keeps the pan', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    dragPan();
    const panned = frameTransform();

    rerender(stageAt(SCENE_PATH, [makeNode('Edited')]));
    projectViewportResolves(rerender);

    expect(frameTransform()).toBe(panned);
  });

  it('fits a newly opened scene after the user moved the view of the last one', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    const fitted = frameTransform();
    dragPan();
    expect(frameTransform()).not.toBe(fitted);

    rerender(stageAt('res://other.tscn'));

    expect(frameTransform()).toBe(fitted);
  });

  it('refits to the project viewport of a newly opened scene that resolves late', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    dragPan();
    rerender(stageAt('res://other.tscn'));

    projectViewportResolves(rerender, 'res://other.tscn');

    expect(frameTransform()).toBe(FITTED_LATE);
  });

  it('does not replay an old Camera2D framing on a remount, so a late viewport refits', () => {
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));
    fireEvent.click(screen.getByRole('button', { name: 'frame camera' }));
    rerender(withoutStage());

    rerender(stageAt('res://other.tscn'));
    projectViewportResolves(rerender, 'res://other.tscn');

    expect(frameTransform()).toBe(FITTED_LATE);
  });

  it('applies a Camera2D framing requested in the click that mounts the stage', () => {
    sizeEveryElement(800, 600);
    render(
      <CameraControlProvider>
        <LookThrough2DHost />
      </CameraControlProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'look through' }));

    // pan = stage/2 − center·zoom → (400 − 600, 300 − 400).
    expect(frameTransform()).toBe('translate(-200px, -100px) scale(2)');
  });

  it('leaves a pinned view where it opened when the project viewport resolves', () => {
    window.localStorage.setItem(FIT_ON_OPEN_2D_STORAGE_KEY, 'false');
    sizeEveryElement(800, 600);
    const { rerender } = render(stageAt(SCENE_PATH));

    projectViewportResolves(rerender);

    expect(frameTransform()).toBe('translate(0px, 0px) scale(1)');
  });
});
