import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  drawsDirectionalSoftShadows,
  searchesDirectionalBlockers,
  setSunSoftShadowAngles,
} from './sunSoftShadow';
import { directionalShadowUserData, type DirectionalShadowDeclaration } from './declaration';
import { attachSplitSun, splitSunOf } from './splitSun';
import { sceneLights } from './lightLists';

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

/** A declared light with its split sun. */
function sunLight(declaration: Partial<DirectionalShadowDeclaration> = {}): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight();
  light.userData = directionalShadowUserData({ ...DECLARATION, ...declaration });
  attachSplitSun(light);
  return light;
}

const camera = new THREE.PerspectiveCamera();

/** The angle `setSunSoftShadowAngles` gives the sun of `light`, the only light of `scene`. */
function angleSet(scene: THREE.Scene, light: THREE.DirectionalLight, drawsSoftShadows: boolean): number {
  setSunSoftShadowAngles(sceneLights(scene), drawsSoftShadows);
  return splitSunOf(light)!.shadow.softShadowAngle;
}

function sceneWith(light: THREE.DirectionalLight): THREE.Scene {
  return new THREE.Scene().add(light);
}

describe('setSunSoftShadowAngles', () => {
  it("sets each sun shadow's angle from its light's declaration", () => {
    const light = sunLight();
    expect(angleSet(sceneWith(light), light, true)).toBe(0.5);
  });

  it('sets no angle while no light turns the soft shadows on (edge case)', () => {
    const light = sunLight();
    const scene = sceneWith(light);
    angleSet(scene, light, true);
    expect(angleSet(scene, light, false)).toBe(0);
  });

  it('sets no angle for a sun whose light lost its declaration (error case)', () => {
    const light = sunLight();
    const scene = sceneWith(light);
    angleSet(scene, light, true);
    light.userData = {};
    expect(angleSet(scene, light, true)).toBe(0);
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
