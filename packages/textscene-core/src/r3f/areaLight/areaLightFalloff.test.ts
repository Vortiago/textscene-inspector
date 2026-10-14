import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AREA_LIGHT_FACINGS,
  AREA_LIGHT_FALLOFFS,
  AREA_LIGHT_TEXTURE_MIPMAPS,
  AREA_LIGHT_TEXTURE_RECTS,
  areaLightUserData,
  installAreaLightUniforms,
  writeAreaLightUniforms,
} from './areaLightFalloff';
import { litUniformArray } from '../testing/litUniformArray';
import { sceneLights } from '../directionalShadow/lightLists';
import { AREA_LIGHT_SHADOWS, installAreaLightShadowUniforms } from './areaLightShadowUniforms';
import { AtlasAreaShadow, type AreaShadowLight } from '../positionalShadow/atlasAreaShadow';
import {
  areaTextureUserData,
  holdAreaTexture,
  releaseAreaTexture,
  updateAreaLightAtlas,
} from './areaLightAtlas';

/** An area light shining down, as AreaLight3D's basis puts its -Z at -Y. */
function downLight(range = 5, attenuation = 1, specular = 1): THREE.RectAreaLight {
  const light = new THREE.RectAreaLight();
  light.rotation.x = -Math.PI / 2;
  light.userData = areaLightUserData({ range, attenuation, specular });
  return light;
}

/** A camera at the origin looking down -Z, whose view space is world space. */
function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera();
  view.updateMatrixWorld();
  return view;
}

function write(scene: THREE.Scene, through = camera()): void {
  scene.updateMatrixWorld();
  writeAreaLightUniforms(sceneLights(scene), through);
}

/** The arrays the lit materials read now. */
function uniforms(): { facings: Float32Array; falloffs: Float32Array } {
  installAreaLightUniforms();
  return { facings: litUniformArray(AREA_LIGHT_FACINGS), falloffs: litUniformArray(AREA_LIGHT_FALLOFFS) };
}

/** The three floats at `index` of `buffer`. */
function at(buffer: Float32Array, index: number): number[] {
  return Array.from(buffer.subarray(index * 3, index * 3 + 3));
}

describe('writeAreaLightUniforms', () => {
  it("writes each light's range, attenuation and twice its specular, in three's order", () => {
    const scene = new THREE.Scene();
    scene.add(downLight(2, 1, 1), downLight(4, 2, 0.5));

    write(scene);

    const { falloffs } = uniforms();
    expect(at(falloffs, 0)).toEqual([2, 1, 2]);
    expect(at(falloffs, 1)).toEqual([4, 2, 1]);
  });

  it('writes the direction the light shines in, in view space', () => {
    const scene = new THREE.Scene();
    scene.add(downLight());
    const lookingDown = new THREE.PerspectiveCamera();
    lookingDown.rotation.x = -Math.PI / 2;
    lookingDown.updateMatrixWorld();

    write(scene, lookingDown);

    const [x, y, z] = at(uniforms().facings, 0);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-1, 6);
  });

  it("ignores the light's scale, as Godot does (edge case)", () => {
    const scene = new THREE.Scene();
    const light = downLight();
    light.scale.set(3, -2, 4);
    scene.add(light);

    write(scene);

    const [x, y, z] = at(uniforms().facings, 0);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(-1, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('puts each light that casts a shadow first, as three sorts its lights (edge case)', () => {
    const scene = new THREE.Scene();
    const casting = downLight(2);
    casting.castShadow = true;
    scene.add(downLight(1), casting, downLight(3));

    write(scene);

    expect([0, 1, 2].map((index) => at(uniforms().falloffs, index)[0])).toEqual([2, 1, 3]);
  });

  it("writes each light's shadow terms at the same index (edge case)", () => {
    const scene = new THREE.Scene();
    const casting = downLight(2) as AreaShadowLight;
    casting.castShadow = true;
    casting.shadow = new AtlasAreaShadow();
    casting.shadow.place({ x: 0, y: 0, size: 512, paraboloidStep: null });
    casting.shadow.intensity = 0.5;
    scene.add(downLight(1), casting);

    write(scene);

    installAreaLightShadowUniforms();
    expect(litUniformArray(AREA_LIGHT_SHADOWS)[0]).toBe(0.5);
  });

  it('gives a hidden light no index, as three gives it no slot (edge case)', () => {
    const scene = new THREE.Scene();
    const hidden = downLight(1);
    hidden.visible = false;
    scene.add(hidden, downLight(2));

    write(scene);

    expect(at(uniforms().falloffs, 0)[0]).toBe(2);
  });

  it("clamps a zero range at Godot's 0.001 (edge case)", () => {
    const scene = new THREE.Scene();
    scene.add(downLight(0));

    write(scene);

    expect(at(uniforms().falloffs, 0)[0]).toBeCloseTo(0.001, 6);
  });

  it("writes past the arrays' first capacity (edge case)", () => {
    const scene = new THREE.Scene();
    const count = uniforms().falloffs.length / 3 + 1;
    for (let i = 0; i < count; i += 1) scene.add(downLight(i + 1));

    write(scene);

    expect(at(uniforms().falloffs, count - 1)[0]).toBe(count);
  });

  it("writes where a textured light's texture lies in the atlas, and its highest mip", () => {
    const texture = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(255), 64, 64);
    holdAreaTexture(texture);
    const light = downLight();
    Object.assign(light.userData, areaTextureUserData(texture));
    const scene = new THREE.Scene();
    scene.add(light);
    updateAreaLightAtlas();

    write(scene);
    releaseAreaTexture(texture);

    installAreaLightUniforms();
    expect([...litUniformArray(AREA_LIGHT_TEXTURE_RECTS).subarray(0, 4)]).toEqual([0, 0, 0.25, 0.25]);
    expect(litUniformArray(AREA_LIGHT_TEXTURE_MIPMAPS)[0]).toBe(5);
  });

  it('writes no texture rectangle for a light without a texture (edge case)', () => {
    const scene = new THREE.Scene();
    scene.add(downLight());

    write(scene);

    installAreaLightUniforms();
    expect([...litUniformArray(AREA_LIGHT_TEXTURE_RECTS).subarray(0, 4)]).toEqual([0, 0, 0, 0]);
  });

  it('writes nothing for a light without falloff, and keeps its index (error case)', () => {
    const scene = new THREE.Scene();
    scene.add(downLight(3), new THREE.RectAreaLight(), downLight(2));

    write(scene);

    expect(at(uniforms().falloffs, 2)[0]).toBe(2);
  });

  it('writes the facing of a light without falloff (edge case)', () => {
    const scene = new THREE.Scene();
    scene.add(downLight(), new THREE.RectAreaLight());

    write(scene);

    const [x, y, z] = at(uniforms().facings, 1);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-1, 6);
  });
});
