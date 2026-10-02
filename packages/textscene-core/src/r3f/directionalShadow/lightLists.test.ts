import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { directionalShadowUserData, type DirectionalShadowDeclaration } from './declaration';
import { declaredDirectionalLights, declaredLights, directionalLightLists, sceneLights } from './lightLists';

const DECLARATION: DirectionalShadowDeclaration = {
  maxDistance: 80,
  pancakeSize: 20,
  fadeStart: 0.8,
  depthBias: -0.002,
  normalBias: 2,
  filterRadius: 2,
  splitCount: 1,
  splitOffsets: [0.1, 0.2, 0.5],
  blendSplits: false,
  sharesAtlas: true,
};

/** A declared, casting light, added to `parent`. */
function addDeclaredLight(
  parent: THREE.Object3D,
  overrides: Partial<DirectionalShadowDeclaration> = {}
): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight();
  light.castShadow = true;
  light.userData = directionalShadowUserData({ ...DECLARATION, ...overrides });
  parent.add(light);
  return light;
}

function listsOf(scene: THREE.Scene) {
  return directionalLightLists(declaredDirectionalLights(sceneLights(scene)));
}

describe('sceneLights', () => {
  it('lists every light in pre-order, as three visits them', () => {
    const scene = new THREE.Scene();
    const [first, nested, last] = [
      new THREE.DirectionalLight(),
      new THREE.SpotLight(),
      new THREE.PointLight(),
    ];
    const group = new THREE.Group();
    group.add(nested);
    scene.add(first, group, last, new THREE.Mesh());
    expect(sceneLights(scene).map(({ light }) => light)).toEqual([first, nested, last]);
  });

  it('marks a light under a hidden parent as one the render does not reach (edge case)', () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    parent.visible = false;
    const hidden = new THREE.DirectionalLight();
    parent.add(hidden);
    const shown = new THREE.DirectionalLight();
    scene.add(parent, shown);
    expect(sceneLights(scene)).toEqual([
      { light: hidden, isVisible: false },
      { light: shown, isVisible: true },
    ]);
  });

  it('answers no light for a scene without one (error case)', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(), new THREE.Group());
    expect(sceneLights(scene)).toEqual([]);
  });
});

describe('declaredDirectionalLights', () => {
  it('keeps the declared directional lights with their declarations', () => {
    const scene = new THREE.Scene();
    const light = addDeclaredLight(scene);
    expect(declaredDirectionalLights(sceneLights(scene))).toEqual([
      { light, declaration: DECLARATION, isVisible: true },
    ]);
  });

  it('keeps a hidden declared light, so the fitter can release its sun (edge case)', () => {
    const scene = new THREE.Scene();
    const light = addDeclaredLight(scene);
    light.visible = false;
    expect(declaredDirectionalLights(sceneLights(scene)).map(({ isVisible }) => isVisible)).toEqual([false]);
  });

  it('leaves out an undeclared light and a light of another kind (error case)', () => {
    const scene = new THREE.Scene();
    const spot = new THREE.SpotLight();
    spot.userData = directionalShadowUserData(DECLARATION);
    scene.add(new THREE.DirectionalLight(), spot);
    expect(declaredDirectionalLights(sceneLights(scene))).toEqual([]);
  });
});

describe('declaredLights', () => {
  const isSpotLight = (light: THREE.Light): light is THREE.SpotLight =>
    (light as THREE.SpotLight).isSpotLight === true;
  const readName = (light: THREE.SpotLight) => (light.name === '' ? null : light.name);

  it('keeps the lights of the kind that made a declaration, in order', () => {
    const scene = new THREE.Scene();
    const [first, second] = [new THREE.SpotLight(), new THREE.SpotLight()];
    first.name = 'first';
    second.name = 'second';
    scene.add(first, second);
    expect(declaredLights(sceneLights(scene), isSpotLight, readName)).toEqual([
      { light: first, declaration: 'first', isVisible: true },
      { light: second, declaration: 'second', isVisible: true },
    ]);
  });

  it('keeps a hidden light with its visibility (edge case)', () => {
    const scene = new THREE.Scene();
    const light = new THREE.SpotLight();
    light.name = 'hidden';
    light.visible = false;
    scene.add(light);
    expect(declaredLights(sceneLights(scene), isSpotLight, readName)).toEqual([
      { light, declaration: 'hidden', isVisible: false },
    ]);
  });

  it('leaves out a light of another kind and a light the reader declines (error case)', () => {
    const scene = new THREE.Scene();
    const point = new THREE.PointLight();
    point.name = 'point';
    scene.add(point, new THREE.SpotLight());
    expect(declaredLights(sceneLights(scene), isSpotLight, readName)).toEqual([]);
  });
});

describe('directionalLightLists', () => {
  it('gives the shadowed lights their shares in visible pre-order', () => {
    const scene = new THREE.Scene();
    const first = addDeclaredLight(scene);
    const group = new THREE.Group();
    const nested = addDeclaredLight(group);
    scene.add(group);
    const { shares } = listsOf(scene);
    expect(shares.get(first)).toEqual({ x: 0, y: 0, width: 2048, height: 4096 });
    expect(shares.get(nested)).toEqual({ x: 2048, y: 0, width: 2048, height: 4096 });
  });

  it('draws the first eight visible lights, shadowed or not', () => {
    const scene = new THREE.Scene();
    const lights = Array.from({ length: 9 }, (_, index) =>
      addDeclaredLight(scene, { sharesAtlas: index > 0 })
    );
    const { drawn, shares } = listsOf(scene);
    expect([...drawn]).toEqual(lights.slice(0, 8));
    expect(shares.size).toBe(7);
    expect(shares.has(lights[8]!)).toBe(false);
  });

  it('draws a light that lights only the sky, and gives it no share', () => {
    const scene = new THREE.Scene();
    const skyOnly = addDeclaredLight(scene, { sharesAtlas: false });
    const light = addDeclaredLight(scene);
    const { drawn, shares } = listsOf(scene);
    expect(drawn.has(skyOnly)).toBe(true);
    expect(shares.has(skyOnly)).toBe(false);
    expect(shares.get(light)).toEqual({ x: 0, y: 0, width: 4096, height: 4096 });
  });

  it('counts a hidden light in neither list, so the ninth visible light is drawn (edge case)', () => {
    const scene = new THREE.Scene();
    const lights = Array.from({ length: 9 }, () => addDeclaredLight(scene));
    lights[0]!.visible = false;
    const { drawn, shares } = listsOf(scene);
    expect(drawn.has(lights[0]!)).toBe(false);
    expect(shares.has(lights[0]!)).toBe(false);
    expect(drawn.has(lights[8]!)).toBe(true);
  });

  it('counts a light whatever its layers, so every camera gets the same lists (edge case)', () => {
    const scene = new THREE.Scene();
    const otherLayer = addDeclaredLight(scene);
    otherLayer.layers.set(5);
    const hiddenByFitter = addDeclaredLight(scene);
    hiddenByFitter.layers.disableAll();
    const { shares } = listsOf(scene);
    expect(shares.get(otherLayer)).toEqual({ x: 0, y: 0, width: 2048, height: 4096 });
    expect(shares.get(hiddenByFitter)).toEqual({ x: 2048, y: 0, width: 2048, height: 4096 });
  });

  it('ignores an undeclared light (error case)', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.DirectionalLight());
    const light = addDeclaredLight(scene);
    const { drawn, shares } = listsOf(scene);
    expect([...drawn]).toEqual([light]);
    expect(shares.get(light)?.width).toBe(4096);
  });
});
