import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyShadowCasting, shadowCastingEffects } from './shadowCasting';
import { depthSideOf } from './testing/threePasses';
import { ShadowCastingSetting } from '../resources/meshlibrary/types';

/** A mesh with one surface of `materialSide`, carrying the hooks of `value`. */
function meshCasting(value: number | undefined, materialSide: THREE.Side): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ side: materialSide }));
  applyShadowCasting(mesh, shadowCastingEffects(value));
  mesh.updateMatrixWorld(true);
  return mesh;
}

function depthSideAfterPass(value: number | undefined, materialSide: THREE.Side): THREE.Side {
  return depthSideOf(meshCasting(value, materialSide));
}

describe('shadowCastingEffects', () => {
  it('defaults an absent cast_shadow to ON', () => {
    // class_geometryinstance3d: cast_shadow defaults to SHADOW_CASTING_SETTING_ON.
    expect(shadowCastingEffects(undefined)).toMatchObject({ castShadow: true, shadowsOnly: false });
  });

  it('OFF stops the mesh casting at all', () => {
    expect(shadowCastingEffects(ShadowCastingSetting.OFF)).toMatchObject({
      castShadow: false,
      shadowsOnly: false,
    });
  });

  it('ON casts and draws', () => {
    expect(shadowCastingEffects(ShadowCastingSetting.ON)).toMatchObject({
      castShadow: true,
      shadowsOnly: false,
    });
  });

  it('DOUBLE_SIDED casts and draws', () => {
    expect(shadowCastingEffects(ShadowCastingSetting.DOUBLE_SIDED)).toMatchObject({
      castShadow: true,
      shadowsOnly: false,
    });
  });

  it('SHADOWS_ONLY casts but is kept out of the colour pass', () => {
    expect(shadowCastingEffects(ShadowCastingSetting.SHADOWS_ONLY)).toMatchObject({
      castShadow: true,
      shadowsOnly: true,
    });
  });

  it('treats an unknown ordinal as ON', () => {
    expect(shadowCastingEffects(9)).toMatchObject({ castShadow: true, shadowsOnly: false });
  });

  it('only DOUBLE_SIDED forces the depth pass to both faces', () => {
    expect(depthSideAfterPass(ShadowCastingSetting.DOUBLE_SIDED, THREE.FrontSide)).toBe(
      THREE.DoubleSide
    );
    expect(depthSideAfterPass(ShadowCastingSetting.DOUBLE_SIDED, THREE.BackSide)).toBe(
      THREE.DoubleSide
    );
  });

  it('undoes three’s flip so every other value keeps the material’s own cull', () => {
    // Godot's shadow pass takes CULL_VARIANT_DOUBLE_SIDED only for
    // FLAG_USES_DOUBLE_SIDED_SHADOWS and otherwise falls through to the
    // material's own cull (`render_forward_clustered.cpp:395-411`). three flips
    // it as its own acne mitigation (`WebGLShadowMap.js:51`).
    for (const value of [undefined, ShadowCastingSetting.OFF, ShadowCastingSetting.ON, ShadowCastingSetting.SHADOWS_ONLY]) {
      expect(depthSideAfterPass(value, THREE.FrontSide)).toBe(THREE.FrontSide);
      expect(depthSideAfterPass(value, THREE.BackSide)).toBe(THREE.BackSide);
    }
  });

  it('never writes the node’s cast_shadow onto the shared material', () => {
    // `cast_shadow` is GeometryInstance3D state, not material state
    // (`servers/rendering/renderer_scene_cull.cpp:732`), and a `.tres` material
    // is shared by every node referencing it.
    const mesh = meshCasting(ShadowCastingSetting.DOUBLE_SIDED, THREE.FrontSide);
    const material = mesh.material as THREE.Material;
    depthSideOf(mesh);
    expect(material.shadowSide).toBeNull();
  });

  it('hands back one stable object per value, so a mesh prop never churns', () => {
    expect(shadowCastingEffects(ShadowCastingSetting.ON)).toBe(shadowCastingEffects(undefined));
    expect(shadowCastingEffects(ShadowCastingSetting.DOUBLE_SIDED)).toBe(
      shadowCastingEffects(ShadowCastingSetting.DOUBLE_SIDED)
    );
  });
});
