import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SUN_SOFT_SHADOWS,
  SUN_RANGE_BEGINS,
  drawsDirectionalSoftShadows,
  installSunSoftShadowUniforms,
  searchesDirectionalBlockers,
  writeSunSoftShadowUniforms,
} from './sunSoftShadow';
import { directionalShadowUserData, type DirectionalShadowDeclaration } from './declaration';
import { attachSplitSun } from './splitSun';
import { sceneLights } from './lightLists';
import { litUniformArray } from '../testing/litUniformArray';

const DECLARATION: DirectionalShadowDeclaration = {
  maxDistance: 100,
  pancakeSize: 20,
  fadeStart: 0.8,
  depthBias: -0.001,
  normalBias: 2,
  filterRadius: 1,
  softShadowAngle: 0.5,
  drawsSoftShadow: true,
  splitCount: 4,
  splitOffsets: [0.1, 0.2, 0.5],
  blendSplits: false,
  sharesAtlas: true,
};

/** A declared light with its split sun, pointed from below towards the light at +Y. */
function sunLight(declaration: Partial<DirectionalShadowDeclaration> = {}): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight();
  light.userData = directionalShadowUserData({ ...DECLARATION, ...declaration });
  const sun = attachSplitSun(light);
  sun.matrixWorld.makeTranslation(0, 10, 0);
  sun.shadow.rangeBegins.set(40, 41, 42, 43);
  return light;
}

const camera = new THREE.PerspectiveCamera();

function written(
  scene: THREE.Scene,
  drawsSoftShadows: boolean
): { shadows: number[]; rangeBegins: number[] } {
  writeSunSoftShadowUniforms(sceneLights(scene), camera, drawsSoftShadows);
  installSunSoftShadowUniforms();
  return {
    shadows: [...litUniformArray(SUN_SOFT_SHADOWS).subarray(0, 4)],
    rangeBegins: [...litUniformArray(SUN_RANGE_BEGINS).subarray(0, 4)],
  };
}

describe('writeSunSoftShadowUniforms', () => {
  it("writes the direction towards the light, the angle and each slot's range start of a sun's shadow", () => {
    const scene = new THREE.Scene();
    scene.add(sunLight());
    const { shadows, rangeBegins } = written(scene, true);
    expect(shadows).toEqual([0, 1, 0, 0.5]);
    expect(rangeBegins).toEqual([40, 41, 42, 43]);
  });

  it('writes no angle while no light turns the soft shadows on (edge case)', () => {
    const scene = new THREE.Scene();
    scene.add(sunLight());
    expect(written(scene, false).shadows[3]).toBe(0);
  });

  it('writes no angle for a sun whose light lost its declaration (error case)', () => {
    const scene = new THREE.Scene();
    const light = sunLight();
    light.userData = {};
    scene.add(light);
    expect(written(scene, true).shadows[3]).toBe(0);
  });
});

describe('drawsDirectionalSoftShadows', () => {
  it('holds while a drawn directional light searches for blockers', () => {
    const scene = new THREE.Scene();
    scene.add(sunLight());
    expect(drawsDirectionalSoftShadows(sceneLights(scene), camera)).toBe(true);
  });

  it('holds for a light that draws no shadow but declares the search (edge case)', () => {
    const scene = new THREE.Scene();
    const light = new THREE.DirectionalLight();
    light.userData = directionalShadowUserData(DECLARATION);
    scene.add(light);
    expect(drawsDirectionalSoftShadows(sceneLights(scene), camera)).toBe(true);
  });

  it('does not hold for a hidden light, which Godot does not draw (error case)', () => {
    const scene = new THREE.Scene();
    const light = sunLight();
    light.visible = false;
    scene.add(light);
    expect(drawsDirectionalSoftShadows(sceneLights(scene), camera)).toBe(false);
  });
});

describe('searchesDirectionalBlockers', () => {
  it('holds while any directional light declares the search, drawn or not', () => {
    const scene = new THREE.Scene();
    const light = sunLight();
    light.visible = false;
    scene.add(light);
    expect(searchesDirectionalBlockers(sceneLights(scene))).toBe(true);
  });

  it('does not hold for a light whose blur or angle turns the search off (edge case)', () => {
    const scene = new THREE.Scene();
    scene.add(sunLight({ drawsSoftShadow: false }));
    expect(searchesDirectionalBlockers(sceneLights(scene))).toBe(false);
  });

  it('does not hold for a light without a declaration, such as a GLB light (error case)', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.DirectionalLight());
    expect(searchesDirectionalBlockers(sceneLights(scene))).toBe(false);
  });
});
