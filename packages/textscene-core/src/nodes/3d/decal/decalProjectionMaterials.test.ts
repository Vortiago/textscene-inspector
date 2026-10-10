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

describe('DecalProjectionMaterials', () => {
  it("shades the projection in the receiver's diffuse mode", () => {
    expect(patchedFragment(materials().shading(lambertReceiver()))).toContain(DRAWS_LAMBERT_DIFFUSE);
  });

  it('shades the projection of a receiver with no recorded mode in Burley, as a glTF import is', () => {
    const projection = materials().shading(receiver(new THREE.MeshStandardMaterial()));
    expect(patchedFragment(projection)).not.toContain(DRAWS_LAMBERT_DIFFUSE);
  });

  it("takes the receiver's roughness and metallic, which the decal's albedo leaves alone", () => {
    const projection = materials().shading(
      receiver(new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }))
    );
    expect([projection.roughness, projection.metalness]).toEqual([0.3, 0.6]);
  });

  it("shades an unshaded receiver's projection as BaseMaterial3D's defaults (edge case)", () => {
    const projection = materials().shading(receiver(new THREE.MeshBasicMaterial()));
    expect([projection.roughness, projection.metalness]).toEqual([1, 0]);
  });

  it('shares one material between receivers that shade alike', () => {
    const decal = materials();
    expect(decal.shading(lambertReceiver())).toBe(decal.shading(lambertReceiver()));
  });

  it('builds a material apart for a receiver that shades differently', () => {
    const decal = materials();
    expect(decal.shading(lambertReceiver())).not.toBe(
      decal.shading(receiver(new THREE.MeshStandardMaterial()))
    );
  });

  it('writes the opacity to every material, and reports the change once', () => {
    const decal = materials();
    const lambert = decal.shading(lambertReceiver());
    const burley = decal.shading(receiver(new THREE.MeshStandardMaterial()));
    expect([decal.setOpacity(0.5), decal.setOpacity(0.5), lambert.opacity, burley.opacity]).toEqual([
      true,
      false,
      0.5,
      0.5,
    ]);
  });

  it('builds the next material afresh after a dispose', () => {
    const decal = materials();
    const first = decal.shading(lambertReceiver());
    decal.dispose();
    expect(decal.shading(lambertReceiver())).not.toBe(first);
  });
});
