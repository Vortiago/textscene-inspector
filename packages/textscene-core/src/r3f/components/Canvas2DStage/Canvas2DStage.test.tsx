/**
 * Canvas2DStage behavior: frame chrome (dimension badge + hints), the zoom
 * HUD (in/out/fit + clamping), wheel-to-zoom, and pointer-capture
 * drag-to-pan. The lazy ControlOverlay barrel is stubbed — overlay layout
 * has its own suites; this one only covers the stage chrome around it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../controls/index.js', () => ({
  ControlOverlay: ({ nodes }: { nodes: readonly unknown[] }) => (
    <div data-testid="overlay-stub" data-node-count={nodes.length} />
  ),
}));

// The 2D-world R3F canvas needs WebGL — stub it, recording the pan/zoom it
// receives so the transform-sync contract is assertable in jsdom.
vi.mock('./World2DCanvas', () => ({
  World2DCanvas: ({
    pan,
    zoom,
    nodes,
  }: {
    pan: { x: number; y: number };
    zoom: number;
    nodes: readonly unknown[];
  }) => (
    <div
      data-testid="world-canvas-stub"
      data-pan={`${pan.x},${pan.y}`}
      data-zoom={zoom}
      data-node-count={nodes.length}
    />
  ),
}));

import { Canvas2DStage } from './Canvas2DStage';
import {
  CameraControlProvider,
  useCameraControl,
} from '../../contexts/CameraControlContext';
import { FIT_ON_OPEN_2D_STORAGE_KEY } from './viewport2d';
import type { TscnNode } from '../../../parser/types';

/**
 * happy-dom reports a zero-sized rect for everything, and `fit()` early-returns
 * on one — so an opening view can only be observed once the stage has a size.
 */
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
  window.localStorage.removeItem(FIT_ON_OPEN_2D_STORAGE_KEY);
});

function makeNode(name: string): TscnNode {
  return { name, type: 'Control', properties: {}, children: [] } as unknown as TscnNode;
}

function renderStage(nodes: TscnNode[] = []) {
  const utils = render(
    <Canvas2DStage nodes={nodes} internalResources={[]} externalResources={[]} />
  );
  const stage = screen.getByLabelText('2D canvas');
  // The frame is the dimension badge's parent — module-class hashing makes
  // class-name queries brittle, the DOM relationship is the stable contract.
  const frame = screen.getByText('1152 × 648').parentElement as HTMLElement;
  return { ...utils, stage, frame };
}

function zoomLabel(): string {
  return screen.getByText(/%$/).textContent ?? '';
}

describe('<Canvas2DStage>', () => {
  it('renders the stage chrome: dimension badge, usage hint, and zoom HUD at 100%', () => {
    renderStage();
    expect(screen.getByText('1152 × 648')).toBeTruthy();
    expect(screen.getByText('scroll = zoom · drag = pan')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Canvas zoom' })).toBeTruthy();
    expect(zoomLabel()).toBe('100%');
  });

  it('mounts the lazy ControlOverlay with the passed nodes', async () => {
    renderStage([makeNode('A'), makeNode('B')]);
    const overlay = await screen.findByTestId('overlay-stub');
    expect(overlay.getAttribute('data-node-count')).toBe('2');
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
    fireEvent.wheel(stage, { deltaY: -1, clientX: 0, clientY: 0 });
    expect(zoomLabel()).toBe('110%');
    fireEvent.wheel(stage, { deltaY: 1, clientX: 0, clientY: 0 });
    expect(zoomLabel()).toBe('100%');
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

  it('frames a 2D camera view on request: centers the view point at the requested zoom', () => {
    // Probe button drives the context the Cameras panel uses.
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
    render(
      <CameraControlProvider>
        <FrameProbe />
        <Canvas2DStage nodes={[]} internalResources={[]} externalResources={[]} />
      </CameraControlProvider>
    );
    const stage = screen.getByLabelText('2D canvas');
    // jsdom rects are 0×0 — give the stage a real size for the centering math.
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
