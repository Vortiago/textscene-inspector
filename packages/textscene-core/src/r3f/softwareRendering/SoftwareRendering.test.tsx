import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { RendererProbe } from '../../testing/recordingWebGL';
import {
  SoftwareRenderingProvider,
  useSoftwareRenderingStore,
  type SoftwareRenderingStore,
} from './SoftwareRenderingContext';
import { SoftwareRenderingProbe } from './SoftwareRenderingProbe';
import { SOFTWARE_RENDERING_STATUS_TESTID, SoftwareRenderingStatus } from './SoftwareRenderingStatus';

const renderer = vi.hoisted(() => ({ inSoftware: false }));
vi.mock('./softwareRenderer', () => ({ rendersInSoftware: () => renderer.inSoftware }));

beforeEach(() => {
  renderer.inSoftware = false;
});

/** A canvas holding the probe, and the store it writes to. */
async function probedCanvas() {
  let store: SoftwareRenderingStore | undefined;
  let gl: THREE.WebGLRenderer | undefined;
  function StoreProbe() {
    store = useSoftwareRenderingStore();
    return null;
  }
  const root = await ReactThreeTestRenderer.create(
    <SoftwareRenderingProvider>
      <StoreProbe />
      <RendererProbe onRenderer={(found) => (gl = found)} />
      <SoftwareRenderingProbe />
    </SoftwareRenderingProvider>
  );
  return { store: store!, gl: gl!, unmount: () => root.unmount() };
}

describe('SoftwareRenderingProbe', () => {
  it('publishes that the canvas draws in software', async () => {
    renderer.inSoftware = true;
    const { store, unmount } = await probedCanvas();
    expect(store.get()).toBe(true);
    await unmount();
  });

  it('publishes nothing for a canvas a GPU draws', async () => {
    const { store, unmount } = await probedCanvas();
    expect(store.get()).toBe(false);
    await unmount();
  });

  it('reads the renderer again when a lost context is restored, which can come back in software', async () => {
    const { store, gl, unmount } = await probedCanvas();
    renderer.inSoftware = true;
    act(() => {
      gl.domElement.dispatchEvent(new Event('webglcontextrestored'));
    });
    expect(store.get()).toBe(true);
    await unmount();
  });
});

describe('SoftwareRenderingStatus', () => {
  function statusWith(inSoftware: boolean) {
    function Publish() {
      const store = useSoftwareRenderingStore();
      useLayoutEffect(() => store.set(inSoftware), [store]);
      return null;
    }
    render(
      <SoftwareRenderingProvider>
        <Publish />
        <SoftwareRenderingStatus />
      </SoftwareRenderingProvider>
    );
  }

  it('shows a polite status, with what to do in its title, while the browser draws in software', () => {
    statusWith(true);
    const status = screen.getByTestId(SOFTWARE_RENDERING_STATUS_TESTID);
    expect(status.textContent).toBe('Software WebGL');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('title')).toMatch(/graphics acceleration/);
  });

  it('is absent while a GPU draws', () => {
    statusWith(false);
    expect(screen.queryByTestId(SOFTWARE_RENDERING_STATUS_TESTID)).toBeNull();
  });

  it('is absent without a provider, since no canvas can publish (edge case)', () => {
    render(<SoftwareRenderingStatus />);
    expect(screen.queryByTestId(SOFTWARE_RENDERING_STATUS_TESTID)).toBeNull();
  });
});
