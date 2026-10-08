import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FadedMeshMaterials, registerAlphaPassBuilder, unfadedMaterial } from './fadedMeshMaterials';

/** A fade whose alpha is 39/255: inside the alpha pass. */
const MARGIN_FADE = 0.15625;

function meshOf(material: THREE.Material | THREE.Material[]): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

describe('registerAlphaPassBuilder', () => {
  it('draws the built variant in the alpha pass', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const alphaPass = new THREE.MeshStandardMaterial({ transparent: true });
    registerAlphaPassBuilder(unfaded, () => alphaPass);
    const mesh = meshOf(unfaded);

    new FadedMeshMaterials(mesh).applyFade(MARGIN_FADE);

    expect(mesh.material).toBe(alphaPass);
  });

  it('builds nothing before the first fade (edge case)', () => {
    const build = vi.fn(() => new THREE.MeshStandardMaterial());
    const unfaded = new THREE.MeshStandardMaterial();
    registerAlphaPassBuilder(unfaded, build);

    new FadedMeshMaterials(meshOf(unfaded)).applyFade(1);

    expect(build).not.toHaveBeenCalled();
  });

  it('disposes the built variant with its unfaded material', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const alphaPass = new THREE.MeshStandardMaterial();
    const disposed = vi.fn();
    alphaPass.addEventListener('dispose', disposed);
    registerAlphaPassBuilder(unfaded, () => alphaPass);
    new FadedMeshMaterials(meshOf(unfaded)).applyFade(MARGIN_FADE);

    unfaded.dispose();

    expect(disposed).toHaveBeenCalledOnce();
  });
});

describe('unfadedMaterial', () => {
  it('gives the unfaded material of an alpha-pass one', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const mesh = meshOf(unfaded);
    new FadedMeshMaterials(mesh).applyFade(MARGIN_FADE);

    expect(unfadedMaterial(mesh.material as THREE.Material)).toBe(unfaded);
  });

  it('gives a material with no alpha-pass role as itself', () => {
    const material = new THREE.MeshStandardMaterial();

    expect(unfadedMaterial(material)).toBe(material);
  });
});

describe('FadedMeshMaterials.applyFade', () => {
  it('draws a copy in the alpha pass, blended with no depth write, at the fade alpha', () => {
    const unfaded = new THREE.MeshStandardMaterial({ opacity: 0.5, transparent: true });
    const mesh = meshOf(unfaded);

    new FadedMeshMaterials(mesh).applyFade(MARGIN_FADE);

    expect(mesh.material).toMatchObject({ transparent: true, depthWrite: false, opacity: 0.5 * (39 / 255) });
    expect(unfaded).toMatchObject({ depthWrite: true, opacity: 0.5 });
  });

  it('builds one copy per material, whatever the number of fades', () => {
    const mesh = meshOf(new THREE.MeshStandardMaterial());
    const faded = new FadedMeshMaterials(mesh);

    faded.applyFade(MARGIN_FADE);
    const first = mesh.material;
    faded.applyFade(0.5);

    expect(mesh.material).toBe(first);
  });

  it('keeps the unfaded material at a fade above the alpha-pass threshold (edge case)', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const mesh = meshOf(unfaded);

    new FadedMeshMaterials(mesh).applyFade(0.9995);

    expect(mesh.material).toBe(unfaded);
  });

  it('fades each slot of a mesh with several draw groups', () => {
    const slots = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
    const mesh = meshOf([...slots]);

    new FadedMeshMaterials(mesh).applyFade(MARGIN_FADE);

    expect((mesh.material as THREE.Material[]).map(unfadedMaterial)).toEqual(slots);
    expect((mesh.material as THREE.Material[]).every((m) => m.transparent)).toBe(true);
  });
});

describe('FadedMeshMaterials.restore', () => {
  it('puts the unfaded material back after a fade', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const mesh = meshOf(unfaded);
    const faded = new FadedMeshMaterials(mesh);
    faded.applyFade(MARGIN_FADE);

    faded.restore();

    expect(mesh.material).toBe(unfaded);
  });

  it('leaves a material another writer put in the slot', () => {
    const mesh = meshOf(new THREE.MeshStandardMaterial());
    const override = new THREE.MeshStandardMaterial();
    const faded = new FadedMeshMaterials(mesh);
    mesh.material = override;

    faded.restore();

    expect(mesh.material).toBe(override);
  });
});
