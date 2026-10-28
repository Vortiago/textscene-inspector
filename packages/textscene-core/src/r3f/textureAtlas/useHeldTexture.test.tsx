/** `useHeldTexture` holds the texture a slot names while the component shows it, and no longer. */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { useHeldTexture } from './useHeldTexture';

const named = vi.hoisted(() => ({ texture: null as THREE.Texture | null }));

vi.mock('../../resources/useTexture2D', () => ({
  useTexture2DRid: () => ({ texture: named.texture }),
}));

vi.mock('../SceneResourcesContext', () => ({
  useSceneResources: () => ({ externalResources: [], internalResources: [] }),
}));

const hold = vi.fn();
const release = vi.fn();

function Holder() {
  useHeldTexture('ExtResource("1")', hold, release);
  return null;
}

describe('useHeldTexture', () => {
  beforeEach(() => {
    hold.mockClear();
    release.mockClear();
  });

  it('holds the named texture once it has loaded', async () => {
    named.texture = new THREE.Texture();

    await ReactThreeTestRenderer.create(<Holder />);

    expect(hold).toHaveBeenCalledExactlyOnceWith(named.texture);
  });

  it('lets go of the texture when the component unmounts', async () => {
    named.texture = new THREE.Texture();
    const renderer = await ReactThreeTestRenderer.create(<Holder />);

    await renderer.unmount();

    expect(release).toHaveBeenCalledExactlyOnceWith(named.texture);
  });

  it('holds nothing while no texture has loaded (edge case)', async () => {
    named.texture = null;

    await ReactThreeTestRenderer.create(<Holder />);

    expect(hold).not.toHaveBeenCalled();
  });
});
