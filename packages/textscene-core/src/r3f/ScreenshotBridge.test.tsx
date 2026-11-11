/** The bridge hands the active canvas's renderer to the viewport actions, for as long as it mounts. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { useEffect, type ReactNode } from 'react';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { ScreenshotBridge } from './ScreenshotBridge';
import { viewportActionsProbe } from './testing/ViewportActionsProbe';
import { CaptureRenderer } from './testing/CaptureRenderer';

const DATA_URL = 'data:image/png;base64,AAA';

/** Puts the canvas's loop in `frameloop`, as the host's visibility does. The test renderer starts at 'never'. */
function Frameloop({ value }: { value: 'always' | 'never' }): null {
  const setFrameloop = useThree((state) => state.setFrameloop);
  useEffect(() => setFrameloop(value), [setFrameloop, value]);
  return null;
}

/**
 * Mounts the bridge under the viewport actions, and returns the actions it registers with and the
 * renderer. The loop runs unless `frameloop` says otherwise, as a visible preview's does.
 */
async function mountBridge(children: ReactNode = null, frameloop: 'always' | 'never' = 'always') {
  const { Probe, actions } = viewportActionsProbe();
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportActionsProvider>
      <Probe />
      <CaptureRenderer captured={captured} />
      <Frameloop value={frameloop} />
      {children}
      <ScreenshotBridge />
    </ViewportActionsProvider>
  );
  return { renderer, actions, gl: captured.current! };
}

afterEach(() => vi.restoreAllMocks());

describe('<ScreenshotBridge>', () => {
  it('captures by rendering the canvas and reading it back as a PNG', async () => {
    const { actions, gl } = await mountBridge();
    const render = vi.spyOn(gl, 'render');
    vi.spyOn(gl.domElement, 'toDataURL').mockReturnValue(DATA_URL);

    expect(actions().takeScreenshot()).toBe(DATA_URL);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('captures what a pass that owns the render draws, such as the compositor', async () => {
    const ownedRender = vi.fn();
    function OwnedRender(): null {
      useFrame(ownedRender, 1);
      return null;
    }
    const { actions, gl } = await mountBridge(<OwnedRender />);
    vi.spyOn(gl.domElement, 'toDataURL').mockReturnValue(DATA_URL);
    ownedRender.mockClear();

    actions().takeScreenshot();

    expect(ownedRender).toHaveBeenCalledTimes(1);
  });

  describe('while the preview is hidden, with the loop off', () => {
    /** Counts the frames that run, and the delta each one hands its callbacks. */
    function frameLog() {
      const deltas: number[] = [];
      function Counter(): null {
        useFrame((_state, delta) => {
          deltas.push(delta);
        });
        return null;
      }
      return { deltas, Counter };
    }

    it('runs one frame and returns the PNG, so a hidden capture matches a visible one', async () => {
      const { deltas, Counter } = frameLog();
      const { actions, gl } = await mountBridge(<Counter />, 'never');
      vi.spyOn(gl.domElement, 'toDataURL').mockReturnValue(DATA_URL);

      expect(actions().takeScreenshot()).toBe(DATA_URL);
      expect(deltas).toHaveLength(1);
    });

    it('hands the frame no time, so an animation holds the pose it paused in', async () => {
      const { deltas, Counter } = frameLog();
      const { actions, gl } = await mountBridge(<Counter />, 'never');
      vi.spyOn(gl.domElement, 'toDataURL').mockReturnValue(DATA_URL);

      actions().takeScreenshot();

      expect(deltas).toEqual([0]);
    });

    it('runs no frame once the capture has returned', async () => {
      const { deltas, Counter } = frameLog();
      const { actions, gl } = await mountBridge(<Counter />, 'never');
      vi.spyOn(gl.domElement, 'toDataURL').mockReturnValue(DATA_URL);
      actions().takeScreenshot();
      const framesOfCapture = deltas.length;

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(deltas).toHaveLength(framesOfCapture);
    });
  });

  it('withdraws its handler when it unmounts (edge case)', async () => {
    const { renderer, actions } = await mountBridge();
    expect(actions().hasScreenshotHandler()).toBe(true);

    await renderer.unmount();

    expect(actions().hasScreenshotHandler()).toBe(false);
  });

  it('registers nothing outside the viewport actions (error path)', async () => {
    await expect(ReactThreeTestRenderer.create(<ScreenshotBridge />)).resolves.toBeDefined();
  });
});
