import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DIRECTIONAL_SOFT_SHADOWS,
  LIGHT_SOFT_SHADOWS,
  defineSoftShadowSearch,
  releaseSoftShadowSearch,
} from './softShadowSearch';

const NO_SEARCH = { positional: false, directional: false };
const POSITIONAL = { positional: true, directional: false };
const DIRECTIONAL = { positional: false, directional: true };

const scenes: THREE.Scene[] = [];

afterEach(() => {
  for (const scene of scenes.splice(0)) releaseSoftShadowSearch(scene);
});

function sceneWith(...materials: THREE.Material[]): THREE.Scene {
  const scene = new THREE.Scene();
  for (const material of materials) scene.add(new THREE.Mesh(new THREE.BufferGeometry(), material));
  scenes.push(scene);
  return scene;
}

describe('defineSoftShadowSearch', () => {
  it('defines the positional search on every lit material of the scene', () => {
    const [standard, lambert] = [new THREE.MeshStandardMaterial(), new THREE.MeshLambertMaterial()];
    defineSoftShadowSearch(sceneWith(standard, lambert), POSITIONAL);
    expect(standard.defines).toHaveProperty(LIGHT_SOFT_SHADOWS);
    expect(lambert.defines).toHaveProperty(LIGHT_SOFT_SHADOWS);
    expect(standard.defines).not.toHaveProperty(DIRECTIONAL_SOFT_SHADOWS);
  });

  it('keeps the material’s own defines', () => {
    const physical = new THREE.MeshPhysicalMaterial();
    defineSoftShadowSearch(sceneWith(physical), DIRECTIONAL);
    expect(physical.defines).toEqual({ STANDARD: '', PHYSICAL: '', [DIRECTIONAL_SOFT_SHADOWS]: '' });
  });

  it('defines the search on each material of a mesh with several, and on a shadow material', () => {
    const [first, second, shadow] = [
      new THREE.MeshStandardMaterial(),
      new THREE.MeshPhongMaterial(),
      new THREE.ShadowMaterial(),
    ];
    const scene = sceneWith(shadow);
    scene.add(new THREE.Mesh(new THREE.BufferGeometry(), [first, second]));
    defineSoftShadowSearch(scene, DIRECTIONAL);
    for (const material of [first, second, shadow])
      expect(material.defines).toHaveProperty(DIRECTIONAL_SOFT_SHADOWS);
  });

  it('recompiles a material only when its defines change', () => {
    const material = new THREE.MeshStandardMaterial();
    const scene = sceneWith(material);
    defineSoftShadowSearch(scene, POSITIONAL);
    const version = material.version;
    defineSoftShadowSearch(scene, POSITIONAL);
    expect(material.version).toBe(version);
    defineSoftShadowSearch(scene, NO_SEARCH);
    expect(material.version).toBe(version + 1);
    expect(material.defines).toEqual({ STANDARD: '' });
  });

  it('defines what any scene needs, so a material two scenes share compiles one program (edge case)', () => {
    const shared = new THREE.MeshStandardMaterial();
    const [first, second] = [sceneWith(shared), sceneWith(shared)];
    defineSoftShadowSearch(first, POSITIONAL);
    defineSoftShadowSearch(second, DIRECTIONAL);
    defineSoftShadowSearch(first, POSITIONAL);
    expect(shared.defines).toHaveProperty(LIGHT_SOFT_SHADOWS);
    expect(shared.defines).toHaveProperty(DIRECTIONAL_SOFT_SHADOWS);
  });

  it('forgets a released scene’s needs (edge case)', () => {
    const material = new THREE.MeshStandardMaterial();
    const [kept, released] = [sceneWith(material), sceneWith()];
    defineSoftShadowSearch(released, POSITIONAL);
    releaseSoftShadowSearch(released);
    defineSoftShadowSearch(kept, NO_SEARCH);
    expect(material.defines).not.toHaveProperty(LIGHT_SOFT_SHADOWS);
  });

  it('writes a new defines object, so a material that shares the old one keeps it (edge case)', () => {
    const shared = { STANDARD: '', [LIGHT_SOFT_SHADOWS]: '' };
    const [drawn, elsewhere] = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
    drawn.defines = elsewhere.defines = shared;
    defineSoftShadowSearch(sceneWith(drawn), NO_SEARCH);
    expect(drawn.defines).toEqual({ STANDARD: '' });
    expect(elsewhere.defines).toBe(shared);
    expect(shared).toHaveProperty(LIGHT_SOFT_SHADOWS);
  });

  it('leaves an unlit material alone (error case)', () => {
    const basic = new THREE.MeshBasicMaterial();
    defineSoftShadowSearch(sceneWith(basic), POSITIONAL);
    expect(basic.defines).toBeUndefined();
  });
});
