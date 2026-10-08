import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { HALF_FADE_ALPHA } from '../testing/halfFadeAlpha';
import type { FadeVariants } from './fadeVariants';
import {
  FadedSurfacesContext,
  useSwappedMaterials,
  type FadedSurface,
  type MaterialAttach,
} from './swappedMaterials';

function Probe({ attach, onAttaches }: { attach?: string; onAttaches: (found: unknown) => void }) {
  onAttaches(useSwappedMaterials(attach));
  return null;
}

/** A mesh with a surface's two materials attached at `attach`, and the surface the fade sets. */
async function swappedOn(attach: string | undefined, opacity = 1) {
  const added: FadedSurface[] = [];
  const surfaces = { add: (surface: FadedSurface) => (added.push(surface), () => {}) };
  let attaches: FadeVariants<MaterialAttach> | null = null;
  await ReactThreeTestRenderer.create(
    <FadedSurfacesContext.Provider value={surfaces}>
      <Probe attach={attach} onAttaches={(found) => (attaches = found as FadeVariants<MaterialAttach>)} />
    </FadedSurfacesContext.Provider>
  );
  const mesh = new THREE.Mesh();
  const unfaded = new THREE.MeshBasicMaterial({ opacity });
  const alphaPass = new THREE.MeshBasicMaterial({ opacity, transparent: true });
  const detach = {
    unfaded: attaches!.unfaded(mesh, unfaded),
    alphaPass: attaches!.alphaPass(mesh, alphaPass),
  };
  return { mesh, unfaded, alphaPass, surface: added[0]!, detach };
}

describe('the swapped materials of a surface', () => {
  it('draws the unfaded material at full fade', async () => {
    const { mesh, unfaded, surface } = await swappedOn(undefined);
    surface.applyFade(1);
    expect(mesh.material).toBe(unfaded);
  });

  it('draws the alpha-pass material below the threshold, at the fade alpha', async () => {
    const { mesh, alphaPass, surface } = await swappedOn(undefined, 0.5);
    surface.applyFade(0.5);
    expect([mesh.material, alphaPass.opacity]).toEqual([alphaPass, 0.5 * HALF_FADE_ALPHA]);
  });

  it('swaps back once the fade returns to full', async () => {
    const { mesh, unfaded, surface } = await swappedOn(undefined);
    surface.applyFade(0.5);
    surface.applyFade(1);
    expect(mesh.material).toBe(unfaded);
  });

  it('swaps only its own draw group (edge case)', async () => {
    const { mesh, alphaPass, surface } = await swappedOn('material-1');
    surface.applyFade(0.5);
    expect((mesh.material as THREE.Material[])[1]).toBe(alphaPass);
  });

  it('keeps the unfaded material once the alpha-pass one detaches (error case)', async () => {
    const { mesh, unfaded, surface, detach } = await swappedOn(undefined);
    detach.alphaPass();
    surface.applyFade(0.5);
    expect(mesh.material).toBe(unfaded);
  });
});

describe('useSwappedMaterials', () => {
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
