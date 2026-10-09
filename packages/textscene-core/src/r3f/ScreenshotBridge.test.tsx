/** The bridge hands the active canvas's renderer to the camera control, for as long as it mounts. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { CameraControlProvider } from './contexts/CameraControlContext';
import { ScreenshotBridge } from './ScreenshotBridge';
import { cameraControlProbe } from './testing/CameraControlProbe';

const DATA_URL = 'data:image/png;base64,AAA';

/** Mounts the bridge under a camera control, and returns the control it registers with and the renderer. */
async function mountBridge() {
  const { Probe, control } = cameraControlProbe();
  let gl: THREE.WebGLRenderer | null = null;
  function RendererProbe(): null {
    gl = useThree((s) => s.gl);
    return null;
  }
  const renderer = await ReactThreeTestRenderer.create(
    <CameraControlProvider>
      <Probe />
      <RendererProbe />
      <ScreenshotBridge />
    </CameraControlProvider>
  );
  return { renderer, control, gl: gl! as THREE.WebGLRenderer };
}

afterEach(() => vi.restoreAllMocks());

describe('<ScreenshotBridge>', () => {
  it('captures by rendering the canvas and reading it back as a PNG', async () => {
    const { control, gl } = await mountBridge();
    const render = vi.spyOn(gl, 'render');
    vi.spyOn(gl.domElement, 'toDataURL').mockReturnValue(DATA_URL);

    expect(control().takeScreenshot()).toBe(DATA_URL);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('withdraws its handler when it unmounts (edge case)', async () => {
    const { renderer, control } = await mountBridge();
    expect(control().hasScreenshotHandler()).toBe(true);

    await renderer.unmount();

    expect(control().hasScreenshotHandler()).toBe(false);
  });

  it('registers nothing outside a camera control (error path)', async () => {
    await expect(ReactThreeTestRenderer.create(<ScreenshotBridge />)).resolves.toBeDefined();
  });
});
