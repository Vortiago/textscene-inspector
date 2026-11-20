import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { RendererProbe } from '../../testing/recordingWebGL';
import { ViewStatusProvider } from '../viewStatus/ViewStatusContext';
import { createViewStatusStore } from '../viewStatus/viewStatus';
import { SoftwareRenderingProbe } from './SoftwareRenderingProbe';

const renderer = vi.hoisted(() => ({ inSoftware: false }));
vi.mock('./softwareRenderer', () => ({ rendersInSoftware: () => renderer.inSoftware }));

beforeEach(() => {
  renderer.inSoftware = false;
});

/** A canvas holding the probe, and the view status it reports to. */
async function probedCanvas() {
  const store = createViewStatusStore();
  let gl: THREE.WebGLRenderer | undefined;
  const root = await ReactThreeTestRenderer.create(
    <ViewStatusProvider store={store}>
      <RendererProbe onRenderer={(found) => (gl = found)} />
      <SoftwareRenderingProbe />
    </ViewStatusProvider>
  );
  const isSoftwareRendering = () => store.status().isSoftwareRendering;
  return { isSoftwareRendering, gl: gl!, unmount: () => root.unmount() };
}

describe('SoftwareRenderingProbe', () => {
  it('reports that the canvas draws in software', async () => {
    renderer.inSoftware = true;
    const { isSoftwareRendering, unmount } = await probedCanvas();
    expect(isSoftwareRendering()).toBe(true);
    await unmount();
  });

  it('reports nothing for a canvas a GPU draws', async () => {
    const { isSoftwareRendering, unmount } = await probedCanvas();
    expect(isSoftwareRendering()).toBe(false);
    await unmount();
  });

  it('reads the renderer again when a lost context is restored, which can come back in software', async () => {
    const { isSoftwareRendering, gl, unmount } = await probedCanvas();
    renderer.inSoftware = true;
    act(() => {
      gl.domElement.dispatchEvent(new Event('webglcontextrestored'));
    });
    expect(isSoftwareRendering()).toBe(true);
    await unmount();
  });
});
