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

/** A fade above the alpha-pass threshold whose byte is 254, short of a full one. */
const NEAR_FULL_FADE = 0.9995;

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

  it('draws the unfaded material at the fade byte, short of a full one', async () => {
    const { mesh, unfaded, surface } = await swappedOn(undefined, 0.8);
    surface.applyFade(NEAR_FULL_FADE);
    expect([mesh.material, unfaded.opacity]).toEqual([unfaded, 0.8 * (254 / 255)]);
  });

  it("restores the owner's opacity at a full fade", async () => {
    const { unfaded, surface } = await swappedOn(undefined, 0.8);
    surface.applyFade(NEAR_FULL_FADE);
    surface.applyFade(1);
    expect(unfaded.opacity).toBe(0.8);
  });

  it('scales an opacity its owner sets while faded (edge case)', async () => {
    const { unfaded, surface } = await swappedOn(undefined, 0.8);
    surface.applyFade(NEAR_FULL_FADE);
    unfaded.opacity = 0.5;
    surface.applyFade(NEAR_FULL_FADE);
    expect(unfaded.opacity).toBe(0.5 * (254 / 255));
  });

  it("fades the alpha-pass material from the owner's opacity, not the scaled one", async () => {
    const { alphaPass, surface } = await swappedOn(undefined, 0.8);
    surface.applyFade(NEAR_FULL_FADE);
    surface.applyFade(0.5);
    expect(alphaPass.opacity).toBe(0.8 * HALF_FADE_ALPHA);
  });

  it("restores the owner's opacity once the unfaded material detaches", async () => {
    const { unfaded, surface, detach } = await swappedOn(undefined, 0.8);
    surface.applyFade(NEAR_FULL_FADE);
    detach.unfaded();
    expect(unfaded.opacity).toBe(0.8);
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
