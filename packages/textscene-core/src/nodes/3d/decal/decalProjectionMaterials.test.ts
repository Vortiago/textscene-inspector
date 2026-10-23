import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DecalProjectionMaterials } from './decalProjectionMaterials';
import { mipmappedTexture } from '../../../r3f/testing/mipmapBiasUniform';
import { dropMipChain } from '../../../resources/textures/godotTextureFilter';
import { lightModesUserData } from '../../../r3f/lightModes';
import { specularOcclusionUserData } from '../../../r3f/godotIndirectSpecular';
import { DiffuseMode } from '../../../godot/rendering/materials/diffuseMode';
import { SpecularMode } from '../../../godot/rendering/materials/specularMode';
import {
  DRAWS_LAMBERT_DIFFUSE,
  DRAWS_TOON_SPECULAR,
  patchedFragment,
} from '../../../r3f/testing/patchedFragment';

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

/** What `buildDecalProjectionGeometry` bakes: UVs over the projected texture, top row at v = 0. */
function projectedGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return geometry;
}

function lambertReceiver(): THREE.Mesh {
  return receiver(
    new THREE.MeshStandardMaterial({
      userData: lightModesUserData({
        diffuseMode: DiffuseMode.DIFFUSE_LAMBERT,
        specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
      }),
    })
  );
}

/** The material a projection onto `onto` draws with. */
function projectionMaterial(decal: DecalProjectionMaterials, onto: THREE.Mesh): THREE.MeshPhysicalMaterial {
  return decal.project(projectedGeometry(), onto).material as THREE.MeshPhysicalMaterial;
}

function decalOf(map: THREE.Texture): DecalProjectionMaterials {
  return new DecalProjectionMaterials({ map, color: new THREE.Color(1, 1, 1), opacity: 1 });
}

function unmipped(): THREE.Texture {
  const texture = mipmappedTexture();
  dropMipChain(texture);
  return texture;
}

describe('DecalProjectionMaterials', () => {
  it("samples a mipmapped decal texture with the viewport's mipmap bias (scene_forward_clustered.glsl:1604)", () => {
    expect(patchedFragment(projectionMaterial(decalOf(mipmappedTexture()), lambertReceiver()))).toContain(
      'godotMipmapBiased( map,'
    );
  });

  it('adds no mipmap bias to a decal texture with no mip chain', () => {
    expect(patchedFragment(projectionMaterial(decalOf(unmipped()), lambertReceiver()))).not.toContain(
      'godotMipmapBias'
    );
  });

  it("shades the projection in the receiver's diffuse mode", () => {
    expect(patchedFragment(projectionMaterial(materials(), lambertReceiver()))).toContain(
      DRAWS_LAMBERT_DIFFUSE
    );
  });

  it("shades the projection in the receiver's specular mode", () => {
    const toonReceiver = receiver(
      new THREE.MeshStandardMaterial({
        userData: lightModesUserData({
          diffuseMode: DiffuseMode.DIFFUSE_BURLEY,
          specularMode: SpecularMode.SPECULAR_TOON,
        }),
      })
    );
    expect(patchedFragment(projectionMaterial(materials(), toonReceiver))).toContain(DRAWS_TOON_SPECULAR);
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

  it("takes the receiver's metallic_specular, which the decal's albedo leaves alone", () => {
    const projection = projectionMaterial(
      materials(),
      receiver(new THREE.MeshPhysicalMaterial({ specularIntensity: 4 }))
    );
    expect(projection.specularIntensity).toBe(4);
  });

  it("keeps Godot's specular occlusion off where the receiver turns it off", () => {
    const projection = projectionMaterial(
      materials(),
      receiver(new THREE.MeshStandardMaterial({ userData: specularOcclusionUserData(true) }))
    );
    expect(patchedFragment(projection)).toMatch(/^#define GODOT_SPECULAR_OCCLUSION_DISABLED$/m);
  });

  it("shades an unshaded receiver's projection as BaseMaterial3D's defaults (edge case)", () => {
    const projection = projectionMaterial(materials(), receiver(new THREE.MeshBasicMaterial()));
    expect([projection.roughness, projection.metalness, projection.specularIntensity]).toEqual([1, 0, 1]);
    expect(patchedFragment(projection)).not.toContain('GODOT_SPECULAR_OCCLUSION_DISABLED');
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
    const mesh = decal.project(projectedGeometry(), onto);
    onto.material = new THREE.MeshStandardMaterial({ roughness: 0.2 });
    expect([decal.followReceivers(), (mesh.material as THREE.MeshPhysicalMaterial).roughness]).toEqual([
      true,
      0.2,
    ]);
  });

  it("re-shades a projection once its receiver's specular occlusion turns off", () => {
    const decal = materials();
    const onto = receiver(new THREE.MeshStandardMaterial());
    decal.project(projectedGeometry(), onto);
    onto.material = new THREE.MeshStandardMaterial({ userData: specularOcclusionUserData(true) });
    expect(decal.followReceivers()).toBe(true);
  });

  it('leaves a projection whose receiver is unchanged, and reports nothing', () => {
    const decal = materials();
    decal.project(projectedGeometry(), lambertReceiver());
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

  describe('the decal atlas rectangle', () => {
    const rect = { x: 0.25, y: 0.5, width: 0.125, height: 0.25 };

    function uvOf(mesh: THREE.Mesh): number[] {
      return [...(mesh.geometry.getAttribute('uv').array as Float32Array)];
    }

    it('hides a projection until its texture has a rectangle', () => {
      const mesh = materials().project(projectedGeometry(), lambertReceiver());
      expect(mesh.visible).toBe(false);
    });

    it('maps the texture UVs into the rectangle, and shows the projection', () => {
      const decal = materials();
      const mesh = decal.project(projectedGeometry(), lambertReceiver());

      expect(decal.placeInAtlas(rect)).toBe(true);

      // uv * size + position: (0, 0) -> (0.25, 0.5), (1, 0) -> (0.375, 0.5), (0.5, 1) -> (0.3125, 0.75).
      expect(uvOf(mesh)).toEqual([0.25, 0.5, 0.375, 0.5, 0.3125, 0.75]);
      expect(mesh.visible).toBe(true);
    });

    it('reports no change for a rectangle it already holds', () => {
      const decal = materials();
      decal.project(projectedGeometry(), lambertReceiver());
      decal.placeInAtlas(rect);

      expect(decal.placeInAtlas({ ...rect })).toBe(false);
    });

    it('moves a projection to a new rectangle from the texture UVs, not from the last rectangle', () => {
      const decal = materials();
      const mesh = decal.project(projectedGeometry(), lambertReceiver());
      decal.placeInAtlas(rect);

      decal.placeInAtlas({ x: 0, y: 0, width: 0.5, height: 0.5 });

      expect(uvOf(mesh)).toEqual([0, 0, 0.5, 0, 0.25, 0.5]);
    });

    it('places a projection built after the rectangle was known', () => {
      const decal = materials();
      decal.placeInAtlas(rect);

      const mesh = decal.project(projectedGeometry(), lambertReceiver());

      expect(uvOf(mesh).slice(0, 2)).toEqual([0.25, 0.5]);
      expect(mesh.visible).toBe(true);
    });

    it('hides the projections again when its texture leaves the atlas (edge case)', () => {
      const decal = materials();
      const mesh = decal.project(projectedGeometry(), lambertReceiver());
      decal.placeInAtlas(rect);

      expect(decal.placeInAtlas(undefined)).toBe(true);
      expect(mesh.visible).toBe(false);
    });
  });

  it('builds the next material afresh after a dispose', () => {
    const decal = materials();
    const first = projectionMaterial(decal, lambertReceiver());
    decal.dispose();
    expect(projectionMaterial(decal, lambertReceiver())).not.toBe(first);
  });
});
