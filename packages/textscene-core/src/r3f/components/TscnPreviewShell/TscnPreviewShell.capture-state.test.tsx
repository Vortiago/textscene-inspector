/**
 * `onCaptureStateChange` reports `ready` only once a canvas registers its screenshot
 * handler, `unavailable` with the reason when the viewport cannot capture, and `pending`
 * in between. A host waits on these states instead of polling the canvas.
 */
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCameraControl } from '../../contexts/CameraControlContext';
import type { PreviewCaptureState } from './previewCaptureState';

const DATA_URL = 'data:image/png;base64,AAA';

/** Written by each test before it renders. The stub canvas reads it as it mounts. */
const canvasStub: { registersHandler: boolean; error: Error | null } = {
  registersHandler: false,
  error: null,
};

// happy-dom has no WebGL, so the R3F canvas is a stub that registers or throws on demand.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: function StubCanvas() {
    const { registerScreenshotHandler } = useCameraControl();
    useEffect(() => {
      if (!canvasStub.registersHandler) return undefined;
      return registerScreenshotHandler(() => DATA_URL);
    }, [registerScreenshotHandler]);
    if (canvasStub.error) throw canvasStub.error;
    return <div data-testid="canvas-stub" />;
  },
  TscnSceneContents: () => null,
}));
vi.mock('../Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: () => <div data-testid="stage-2d-stub" />,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const SCENE_3D = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

function renderShell(): { states: PreviewCaptureState[]; unmount: () => void } {
  const states: PreviewCaptureState[] = [];
  const { unmount } = render(
    <TscnPreviewShell
      panelId="capture"
      content={SCENE_3D}
      initialViewportMode="3D"
      onCaptureStateChange={(state) => states.push(state)}
    />
  );
  return { states, unmount };
}

function latest(states: PreviewCaptureState[]): PreviewCaptureState | undefined {
  return states[states.length - 1];
}

describe('<TscnPreviewShell> capture state', () => {
  it('reports pending while the canvas has no screenshot handler', () => {
    canvasStub.registersHandler = false;
    canvasStub.error = null;

    const { states } = renderShell();

    expect(latest(states)).toEqual({ status: 'pending' });
  });

  it('reports ready with a working capture once the canvas registers its handler', () => {
    canvasStub.registersHandler = true;
    canvasStub.error = null;

    const { states } = renderShell();
    const state = latest(states);

    expect(state?.status).toBe('ready');
    expect(state?.status === 'ready' && state.capture()).toBe(DATA_URL);
  });

  it('reports the renderer error when the canvas cannot create a WebGL context', () => {
    canvasStub.registersHandler = false;
    canvasStub.error = new Error('THREE.WebGLRenderer: Error creating WebGL context.');
    // The boundary logs the caught error, which is the case under test.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { states } = renderShell();
    consoleError.mockRestore();

    expect(latest(states)).toEqual({
      status: 'unavailable',
      reason: 'The viewport crashed: THREE.WebGLRenderer: Error creating WebGL context.',
    });
  });

  it('reports unavailable in the 2D view, which registers no screenshot handler', async () => {
    canvasStub.registersHandler = true;
    canvasStub.error = null;
    const { states } = renderShell();

    await userEvent.click(screen.getByRole('button', { name: '2D' }));

    expect(latest(states)).toEqual({
      status: 'unavailable',
      reason: 'The preview shows the 2D view, and only the 3D view can capture.',
    });
  });

  it('reports pending as the shell unmounts', () => {
    canvasStub.registersHandler = true;
    canvasStub.error = null;
    const { states, unmount } = renderShell();

    act(() => unmount());

    expect(latest(states)).toEqual({ status: 'pending' });
  });
});
