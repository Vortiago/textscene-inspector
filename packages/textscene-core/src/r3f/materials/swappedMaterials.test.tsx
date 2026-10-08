import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { HALF_FADE_ALPHA } from '../testing/halfFadeAlpha';
import {
  FadedSurfacesContext,
  SwappedMaterials,
  useSwappedMaterials,
  type FadedSurface,
} from './swappedMaterials';

/** A mesh with a surface's two materials attached at `drawGroup`. */
function swappedOn(drawGroup: number | null, opacity = 1) {
  const mesh = new THREE.Mesh();
  const unfaded = new THREE.MeshBasicMaterial({ opacity });
  const alphaPass = new THREE.MeshBasicMaterial({ opacity, transparent: true });
  const swapped = new SwappedMaterials(drawGroup);
  const detach = {
    unfaded: swapped.attach('unfaded', mesh, unfaded),
    alphaPass: swapped.attach('alphaPass', mesh, alphaPass),
  };
  return { mesh, unfaded, alphaPass, swapped, detach };
}

describe('SwappedMaterials', () => {
  it('draws the unfaded material at full fade', () => {
    const { mesh, unfaded, swapped } = swappedOn(null);
    swapped.applyFade(1);
    expect(mesh.material).toBe(unfaded);
  });

  it('draws the alpha-pass material below the threshold, at the fade alpha', () => {
    const { mesh, alphaPass, swapped } = swappedOn(null, 0.5);
    swapped.applyFade(0.5);
    expect([mesh.material, alphaPass.opacity]).toEqual([alphaPass, 0.5 * HALF_FADE_ALPHA]);
  });

  it('swaps back once the fade returns to full', () => {
    const { mesh, unfaded, swapped } = swappedOn(null);
    swapped.applyFade(0.5);
    swapped.applyFade(1);
    expect(mesh.material).toBe(unfaded);
  });

  it('swaps only its own draw group (edge case)', () => {
    const { mesh, alphaPass, swapped } = swappedOn(1);
    swapped.applyFade(0.5);
    expect((mesh.material as THREE.Material[])[1]).toBe(alphaPass);
  });

  it('keeps the unfaded material once the alpha-pass one detaches (error case)', () => {
    const { mesh, unfaded, swapped, detach } = swappedOn(null);
    detach.alphaPass();
    swapped.applyFade(0.5);
    expect(mesh.material).toBe(unfaded);
  });
});

describe('useSwappedMaterials', () => {
  function Probe({ attach, onAttaches }: { attach?: string; onAttaches: (found: unknown) => void }) {
    onAttaches(useSwappedMaterials(attach));
    return null;
  }

  it('gives a surface two attaches inside a GeometryInstance3D drawer', async () => {
    const added: FadedSurface[] = [];
    const surfaces = { add: (surface: FadedSurface) => (added.push(surface), () => {}) };
    let found: unknown = null;
    await ReactThreeTestRenderer.create(
      <FadedSurfacesContext.Provider value={surfaces}>
        <Probe onAttaches={(attaches) => (found = attaches)} />
      </FadedSurfacesContext.Provider>
    );
    expect([typeof found, added.length]).toEqual(['object', 1]);
  });

  it('gives none outside one (edge case)', async () => {
    let found: unknown = undefined;
    await ReactThreeTestRenderer.create(<Probe onAttaches={(attaches) => (found = attaches)} />);
    expect(found).toBeNull();
  });

  it('refuses an attach key that names no material slot (error case)', async () => {
    const surfaces = { add: () => () => {} };
    const mount = ReactThreeTestRenderer.create(
      <FadedSurfacesContext.Provider value={surfaces}>
        <Probe attach="geometry" onAttaches={() => {}} />
      </FadedSurfacesContext.Provider>
    );
    await expect(mount).rejects.toThrow('expected a material attach key such as material-1, got geometry');
  });
});
