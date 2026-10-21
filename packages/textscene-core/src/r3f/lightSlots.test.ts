import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sceneLights } from './directionalShadow/lightLists';
import { SplitSunLight } from './directionalShadow/splitSun';
import {
  isPositionalKind,
  LIGHT_SLOT_LOOPS,
  slotArrayDeclaration,
  slottedLights,
  slotValues,
} from './lightSlots';

const camera = new THREE.PerspectiveCamera();

describe('slottedLights', () => {
  it('files each light under the kind three gives it a slot as', () => {
    const scene = new THREE.Scene();
    const [spot, point, directional, sun] = [
      new THREE.SpotLight(),
      new THREE.PointLight(),
      new THREE.DirectionalLight(),
      new SplitSunLight(),
    ];
    directional.add(sun);
    scene.add(spot, point, directional);
    expect(slottedLights(sceneLights(scene), camera)).toEqual({
      directional: [directional],
      sun: [sun],
      point: [point],
      spot: [spot],
      area: [],
    });
  });

  it('files a rect area light under the area kind, in slot order', () => {
    const scene = new THREE.Scene();
    const [plain, shadowed] = [new THREE.RectAreaLight(), new THREE.RectAreaLight()];
    shadowed.castShadow = true;
    scene.add(plain, shadowed);
    expect(slottedLights(sceneLights(scene), camera).area).toEqual([shadowed, plain]);
  });

  it("puts a shadowed light first among its kind, as three's sort does", () => {
    const scene = new THREE.Scene();
    const [plain, shadowed] = [new THREE.PointLight(), new THREE.PointLight()];
    shadowed.castShadow = true;
    scene.add(plain, shadowed);
    expect(slottedLights(sceneLights(scene), camera).point).toEqual([shadowed, plain]);
  });

  it('keeps tree order among the lights of a kind that rank alike', () => {
    const scene = new THREE.Scene();
    const [first, second] = [new THREE.SpotLight(), new THREE.SpotLight()];
    scene.add(first, second);
    expect(slottedLights(sceneLights(scene), camera).spot).toEqual([first, second]);
  });

  it('gives a hidden light no slot (edge case)', () => {
    const scene = new THREE.Scene();
    const hidden = new THREE.PointLight();
    hidden.visible = false;
    scene.add(hidden);
    expect(slottedLights(sceneLights(scene), camera).point).toEqual([]);
  });

  it('gives a light on a layer the camera does not see no slot (error case)', () => {
    const scene = new THREE.Scene();
    const light = new THREE.SpotLight();
    light.layers.set(5);
    scene.add(light);
    expect(slottedLights(sceneLights(scene), camera).spot).toEqual([]);
  });
});

describe('slotValues', () => {
  it("answers each slotted light's value in slot order: directional, sun, point, spot", () => {
    const scene = new THREE.Scene();
    const [spot, point, directional, sun] = [
      new THREE.SpotLight(),
      new THREE.PointLight(),
      new THREE.DirectionalLight(),
      new SplitSunLight(),
    ];
    directional.add(sun);
    scene.add(spot, point, directional);
    const valueOf = { directional: 1, sun: 2, point: 3, spot: 4 };

    expect(slotValues(slottedLights(sceneLights(scene), camera), (_light, kind) => valueOf[kind])).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('hands each value its own light', () => {
    const scene = new THREE.Scene();
    const [plain, shadowed] = [new THREE.PointLight(), new THREE.PointLight()];
    shadowed.castShadow = true;
    scene.add(plain, shadowed);

    expect(
      slotValues(slottedLights(sceneLights(scene), camera), (light) => (light === shadowed ? 7 : 0))
    ).toEqual([7, 0]);
  });

  it('answers no values for a scene without lights (edge case)', () => {
    expect(slotValues(slottedLights(sceneLights(new THREE.Scene()), camera), () => 1)).toEqual([]);
  });
});

describe('slotArrayDeclaration', () => {
  it('declares one float per shaded light, only when there is a light to size it', () => {
    expect(slotArrayDeclaration('godotValues')).toBe(
      '#if NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + NUM_SPOT_LIGHTS > 0\n' +
        '\tuniform float godotValues[ NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + NUM_SPOT_LIGHTS ];\n' +
        '#endif\n'
    );
  });
});

describe('LIGHT_SLOT_LOOPS', () => {
  it("reads each kind's slots after the kinds before it", () => {
    expect(LIGHT_SLOT_LOOPS.map(({ slot }) => slot)).toEqual([
      'UNROLLED_LOOP_INDEX',
      'NUM_DIR_LIGHTS + UNROLLED_LOOP_INDEX',
      'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + UNROLLED_LOOP_INDEX',
      'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + UNROLLED_LOOP_INDEX',
    ]);
  });
});

describe('isPositionalKind', () => {
  it('answers true for the point and spot kinds only', () => {
    const kinds = ['directional', 'sun', 'point', 'spot'] as const;
    expect(kinds.filter(isPositionalKind)).toEqual(['point', 'spot']);
  });
});
