/** The bridge hands the active canvas's renderer to the viewport actions, for as long as it mounts. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { ReactNode } from 'react';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { ScreenshotBridge } from './ScreenshotBridge';
import { viewportActionsProbe } from './testing/ViewportActionsProbe';
import { CaptureRenderer } from './testing/CaptureRenderer';

const DATA_URL = 'data:image/png;base64,AAA';

/** Mounts the bridge under the viewport actions, and returns the actions it registers with and the renderer. */
async function mountBridge(children: ReactNode = null) {
  const { Probe, actions } = viewportActionsProbe();
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportActionsProvider>
      <Probe />
      <CaptureRenderer captured={captured} />
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
