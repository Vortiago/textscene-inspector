/**
 * Canvas2DStage behavior: frame chrome (dimension badge + hints), the zoom
 * HUD (in/out/fit + clamping), wheel-to-zoom, and pointer-capture
 * drag-to-pan. The lazy ControlOverlay barrel is stubbed — overlay layout
 * has its own suites; this one only covers the stage chrome around it.
 */
import { describe, expect, it, vi } from 'vitest';
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
import type { TscnNode } from '../../../parser/types';

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

  it('ignores pointer move when no drag is active, and non-primary buttons', () => {
    const { stage, frame } = renderStage();
    fireEvent.pointerMove(stage, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(frame.style.transform).toBe('translate(0px, 0px) scale(1)');

    fireEvent.pointerDown(stage, { button: 2, clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 50, clientY: 50, pointerId: 1 });
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
