import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DecalProjectionMaterials } from './decalProjectionMaterials';
import { diffuseModeUserData } from '../../../r3f/godotDiffuse';
import { DiffuseMode } from '../../../godot/diffuseMode';
import { DRAWS_LAMBERT_DIFFUSE, patchedFragment } from '../../../r3f/testing/patchedFragment';

function materials(): DecalProjectionMaterials {
  return new DecalProjectionMaterials({
    map: new THREE.Texture(),
    color: new THREE.Color(1, 1, 1),
    opacity: 1,
  });
}

function receiver(material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

function lambertReceiver(): THREE.Mesh {
  return receiver(
    new THREE.MeshStandardMaterial({ userData: diffuseModeUserData(DiffuseMode.DIFFUSE_LAMBERT) })
  );
}

/** The material a projection onto `onto` draws with. */
function projectionMaterial(decal: DecalProjectionMaterials, onto: THREE.Mesh): THREE.MeshStandardMaterial {
  return decal.project(new THREE.BufferGeometry(), onto).material as THREE.MeshStandardMaterial;
}

describe('DecalProjectionMaterials', () => {
  it("shades the projection in the receiver's diffuse mode", () => {
    expect(patchedFragment(projectionMaterial(materials(), lambertReceiver()))).toContain(
      DRAWS_LAMBERT_DIFFUSE
    );
  });

  it('shades the projection of a receiver with no recorded mode in Burley, as a glTF import is', () => {
    const projection = projectionMaterial(materials(), receiver(new THREE.MeshStandardMaterial()));
    expect(patchedFragment(projection)).not.toContain(DRAWS_LAMBERT_DIFFUSE);
  });

  it("takes the receiver's roughness and metallic, which the decal's albedo leaves alone", () => {
    const shiny = receiver(new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }));
    const projection = projectionMaterial(materials(), shiny);
    expect([projection.roughness, projection.metalness]).toEqual([0.3, 0.6]);
  });

  it("shades an unshaded receiver's projection as BaseMaterial3D's defaults (edge case)", () => {
    const projection = projectionMaterial(materials(), receiver(new THREE.MeshBasicMaterial()));
    expect([projection.roughness, projection.metalness]).toEqual([1, 0]);
  });

  it('shares one material between receivers that shade alike', () => {
    const decal = materials();
    expect(projectionMaterial(decal, lambertReceiver())).toBe(projectionMaterial(decal, lambertReceiver()));
  });

  it('builds a material apart for a receiver that shades differently', () => {
    const decal = materials();
    const burley = receiver(new THREE.MeshStandardMaterial());
    expect(projectionMaterial(decal, lambertReceiver())).not.toBe(projectionMaterial(decal, burley));
  });

  it("re-shades a projection once its receiver's terms move", () => {
    const decal = materials();
    const onto = receiver(new THREE.MeshStandardMaterial());
    const mesh = decal.project(new THREE.BufferGeometry(), onto);
    onto.material = new THREE.MeshStandardMaterial({ roughness: 0.2 });
    expect([decal.followReceivers(), (mesh.material as THREE.MeshStandardMaterial).roughness]).toEqual([
      true,
      0.2,
    ]);
  });

  it('leaves a projection whose receiver is unchanged, and reports nothing', () => {
    const decal = materials();
    decal.project(new THREE.BufferGeometry(), lambertReceiver());
    expect(decal.followReceivers()).toBe(false);
  });

  it('writes the opacity to every material, and reports the change once', () => {
    const decal = materials();
    const lambert = projectionMaterial(decal, lambertReceiver());
    const burley = projectionMaterial(decal, receiver(new THREE.MeshStandardMaterial()));
    expect([decal.setOpacity(0.5), decal.setOpacity(0.5), lambert.opacity, burley.opacity]).toEqual([
      true,
      false,
      0.5,
      0.5,
    ]);
  });

  it('builds the next material afresh after a dispose', () => {
    const decal = materials();
    const first = projectionMaterial(decal, lambertReceiver());
    decal.dispose();
    expect(projectionMaterial(decal, lambertReceiver())).not.toBe(first);
  });
});
