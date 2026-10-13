import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { areaLightUniformValues, areaLightUserData, writeAreaLightUniforms } from './areaLightFalloff';
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

/** The three floats at `index` of `buffer`. */
function at(buffer: Float32Array, index: number): number[] {
  return Array.from(buffer.subarray(index * 3, index * 3 + 3));
}

describe('writeAreaLightUniforms', () => {
  it("writes each light's inverse range, attenuation and twice its specular, in three's order", () => {
    const scene = new THREE.Scene();
    scene.add(downLight(2, 1, 1), downLight(4, 2, 0.5));

    write(scene);

    const { falloffs } = areaLightUniformValues();
    expect(at(falloffs, 0)).toEqual([0.5, 1, 2]);
    expect(at(falloffs, 1)).toEqual([0.25, 2, 1]);
  });

  it('writes the direction the light shines in, in view space', () => {
    const scene = new THREE.Scene();
    scene.add(downLight());
    const lookingDown = new THREE.PerspectiveCamera();
    lookingDown.rotation.x = -Math.PI / 2;
    lookingDown.updateMatrixWorld();

    write(scene, lookingDown);

    const [x, y, z] = at(areaLightUniformValues().facings, 0);
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

    const [x, y, z] = at(areaLightUniformValues().facings, 0);
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

    expect(at(areaLightUniformValues().falloffs, 0)[0]).toBe(0.5);
  });

  it("clamps a zero range at Godot's 0.001 (edge case)", () => {
    const scene = new THREE.Scene();
    scene.add(downLight(0));

    write(scene);

    expect(at(areaLightUniformValues().falloffs, 0)[0]).toBeCloseTo(1000, 3);
  });

  it('grows the buffers past their capacity, and keeps writing the buffers a program holds', () => {
    const before = areaLightUniformValues().falloffs;
    const scene = new THREE.Scene();
    const count = before.length / 3 + 1;
    for (let i = 0; i < count; i += 1) scene.add(downLight(i + 1));

    write(scene);

    const { falloffs } = areaLightUniformValues();
    expect(falloffs.length).toBeGreaterThanOrEqual(count * 3);
    expect(at(falloffs, count - 1)[0]).toBeCloseTo(1 / count, 6);
    expect(at(before, 0)[0]).toBe(1);
  });

  it('writes nothing for a light without falloff, and keeps its index (error case)', () => {
    const scene = new THREE.Scene();
    scene.add(downLight(3), new THREE.RectAreaLight(), downLight(2));

    write(scene);

    expect(at(areaLightUniformValues().falloffs, 2)[0]).toBe(0.5);
  });
});
