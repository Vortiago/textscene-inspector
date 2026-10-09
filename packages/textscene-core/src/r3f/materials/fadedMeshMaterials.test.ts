import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FadedMeshMaterials, registerFadedCopyBuilders, unfadedMaterial } from './fadedMeshMaterials';
import {
  DRAWN_OPAQUE_PREPASS,
  FADED_OPAQUE_PREPASS,
  NO_OPAQUE_PREPASS,
  opaquePrepassOf,
  opaquePrepassUserData,
} from './opaquePrepass';

/** A fade whose alpha is 39/255: inside the alpha pass. */
const MARGIN_FADE = 0.15625;
/** A fade above the alpha-pass threshold whose byte is 254, short of a full one. */
const NEAR_FULL_FADE = 0.9995;

function meshOf(material: THREE.Material | THREE.Material[]): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

/** Builders that hand out `built` for each pass. */
function buildersOf(built: { unfaded?: THREE.Material; alphaPass?: THREE.Material }) {
  return {
    unfaded: () => built.unfaded ?? new THREE.MeshStandardMaterial(),
    alphaPass: () => built.alphaPass ?? new THREE.MeshStandardMaterial(),
  };
}

describe('registerFadedCopyBuilders', () => {
  it('draws the built alpha-pass copy in the alpha pass', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const alphaPass = new THREE.MeshStandardMaterial({ transparent: true });
    registerFadedCopyBuilders(unfaded, buildersOf({ alphaPass }));
    const mesh = meshOf(unfaded);

    new FadedMeshMaterials(mesh).applyFade(MARGIN_FADE);

    expect(mesh.material).toBe(alphaPass);
  });

  it('draws the built own-pass copy at a fade byte short of a full one', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const ownPass = new THREE.MeshStandardMaterial();
    registerFadedCopyBuilders(unfaded, buildersOf({ unfaded: ownPass }));
    const mesh = meshOf(unfaded);

    new FadedMeshMaterials(mesh).applyFade(NEAR_FULL_FADE);

    expect(mesh.material).toBe(ownPass);
  });

  it('builds nothing before the first fade (edge case)', () => {
    const build = vi.fn(() => new THREE.MeshStandardMaterial());
    const unfaded = new THREE.MeshStandardMaterial();
    registerFadedCopyBuilders(unfaded, { unfaded: build, alphaPass: build });

    new FadedMeshMaterials(meshOf(unfaded)).applyFade(1);

    expect(build).not.toHaveBeenCalled();
  });

  it('disposes the built copy with its unfaded material', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const alphaPass = new THREE.MeshStandardMaterial();
    const disposed = vi.fn();
    alphaPass.addEventListener('dispose', disposed);
    registerFadedCopyBuilders(unfaded, buildersOf({ alphaPass }));
    new FadedMeshMaterials(meshOf(unfaded)).applyFade(MARGIN_FADE);

    unfaded.dispose();

    expect(disposed).toHaveBeenCalledOnce();
  });
});

describe('unfadedMaterial', () => {
  it('gives the unfaded material of a faded copy', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const mesh = meshOf(unfaded);
    new FadedMeshMaterials(mesh).applyFade(MARGIN_FADE);

    expect(unfadedMaterial(mesh.material as THREE.Material)).toBe(unfaded);
  });

  it('gives a material that is no faded copy as itself', () => {
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

  it('gives each mesh that shares a material its own copy, at its own fade', () => {
    const shared = new THREE.MeshStandardMaterial();
    const near = meshOf(shared);
    const far = meshOf(shared);

    new FadedMeshMaterials(near).applyFade(MARGIN_FADE);
    new FadedMeshMaterials(far).applyFade(0.5);

    expect(near.material).not.toBe(far.material);
    expect((near.material as THREE.Material).opacity).toBe(39 / 255);
    expect((far.material as THREE.Material).opacity).toBe(127 / 255);
  });

  it('draws an unblended copy at the fade byte above the alpha-pass threshold (edge case)', () => {
    const unfaded = new THREE.MeshStandardMaterial({ opacity: 0.8, alphaTest: 0.5 });
    const mesh = meshOf(unfaded);

    new FadedMeshMaterials(mesh).applyFade(NEAR_FULL_FADE);

    expect(mesh.material).toMatchObject({ transparent: false, alphaTest: 0.5, opacity: 0.8 * (254 / 255) });
    expect(unfaded.opacity).toBe(0.8);
  });

  it('draws the unfaded material itself at a full fade', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const mesh = meshOf(unfaded);
    const faded = new FadedMeshMaterials(mesh);

    faded.applyFade(NEAR_FULL_FADE);
    faded.applyFade(1);

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

describe('FadedMeshMaterials.applyFade on a depth-prepass surface', () => {
  const prepassSurface = () =>
    new THREE.MeshStandardMaterial({
      transparent: true,
      userData: opaquePrepassUserData(DRAWN_OPAQUE_PREPASS),
    });

  it('keeps an alpha-pass copy out of the depth prepass, as the fade forces the alpha pass', () => {
    // `render_forward_clustered.cpp:1128-1134`.
    const mesh = meshOf(prepassSurface());
    new FadedMeshMaterials(mesh).applyFade(MARGIN_FADE);
    expect(opaquePrepassOf(mesh.material as THREE.Material)).toEqual(FADED_OPAQUE_PREPASS);
  });

  it('keeps the depth prepass of a copy above the alpha-pass threshold (edge case)', () => {
    const mesh = meshOf(prepassSurface());
    new FadedMeshMaterials(mesh).applyFade(NEAR_FULL_FADE);
    expect(opaquePrepassOf(mesh.material as THREE.Material)).toEqual(DRAWN_OPAQUE_PREPASS);
  });

  it('gives an alpha-pass copy of a surface with no prepass none', () => {
    const mesh = meshOf(new THREE.MeshStandardMaterial());
    new FadedMeshMaterials(mesh).applyFade(MARGIN_FADE);
    expect(opaquePrepassOf(mesh.material as THREE.Material)).toBe(NO_OPAQUE_PREPASS);
  });
});

describe('FadedMeshMaterials.dispose', () => {
  it('puts the unfaded material back and disposes the faded copy', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const mesh = meshOf(unfaded);
    const faded = new FadedMeshMaterials(mesh);
    faded.applyFade(MARGIN_FADE);
    const disposed = vi.fn();
    (mesh.material as THREE.Material).addEventListener('dispose', disposed);

    faded.dispose();

    expect(mesh.material).toBe(unfaded);
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('leaves the unfaded material undisposed (edge case)', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const disposed = vi.fn();
    unfaded.addEventListener('dispose', disposed);
    const faded = new FadedMeshMaterials(meshOf(unfaded));
    faded.applyFade(MARGIN_FADE);

    faded.dispose();

    expect(disposed).not.toHaveBeenCalled();
  });

  it('disposes nothing for a mesh that never faded (error case)', () => {
    const unfaded = new THREE.MeshStandardMaterial();
    const mesh = meshOf(unfaded);

    new FadedMeshMaterials(mesh).dispose();

    expect(mesh.material).toBe(unfaded);
  });

  it('leaves a material another writer put in the slot (edge case)', () => {
    const mesh = meshOf(new THREE.MeshStandardMaterial());
    const override = new THREE.MeshStandardMaterial();
    const faded = new FadedMeshMaterials(mesh);
    mesh.material = override;

    faded.dispose();

    expect(mesh.material).toBe(override);
  });
});
