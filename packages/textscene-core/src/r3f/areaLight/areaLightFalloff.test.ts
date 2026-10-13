import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AREA_LIGHT_FACINGS,
  AREA_LIGHT_FALLOFFS,
  areaLightUserData,
  installAreaLightUniforms,
  writeAreaLightUniforms,
} from './areaLightFalloff';
import { litUniformArray } from '../testing/litUniformArray';
import { sceneLights } from '../directionalShadow/lightLists';

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
