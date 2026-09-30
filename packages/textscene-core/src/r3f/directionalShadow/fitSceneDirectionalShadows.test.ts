import { beforeEach, describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { directionalShadowUserData, type DirectionalShadowDeclaration } from './declaration';
import {
  directionalShadowCasters,
  fitSceneDirectionalShadows,
  releaseSceneSplitSuns,
} from './fitSceneDirectionalShadows';
import { writeDirectionalShadowFades } from './shadowFade';
import { SplitSunLight, splitSunOf } from './splitSun';
import { WebGLLights } from 'three/src/renderers/webgl/WebGLLights.js';
import type { WebGLExtensions } from 'three/src/renderers/webgl/WebGLExtensions.js';

vi.mock('./shadowFade', () => ({ writeDirectionalShadowFades: vi.fn() }));

const writtenFades = vi.mocked(writeDirectionalShadowFades);

beforeEach(() => {
  writtenFades.mockClear();
});

const DECLARATION: DirectionalShadowDeclaration = {
  maxDistance: 80,
  pancakeSize: 20,
  fadeStart: 0.8,
  depthBias: -0.002,
  normalBias: 2,
  splitCount: 1,
  splitOffsets: [0.1, 0.2, 0.5],
  blendSplits: false,
};

function viewingCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 4000);
  camera.position.set(0, 10, 40);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function sceneWithSun(options: { declared: boolean; casts: boolean; splitCount?: number }): {
  scene: THREE.Scene;
  light: THREE.DirectionalLight;
} {
  const scene = new THREE.Scene();
  const light = new THREE.DirectionalLight(0xff8000, 3);
  light.position.set(10, 20, 5);
  light.castShadow = options.casts;
  if (options.declared) {
    light.userData = directionalShadowUserData({ ...DECLARATION, splitCount: options.splitCount ?? 1 });
  }
  scene.add(light, light.target);
  // `WebGLRenderer.render` updates the world matrices before the hook that runs the fit.
  scene.updateMatrixWorld();
  return { scene, light };
}

/** A shadow camera as three constructs it, before anything fits it. */
const UNFITTED = new THREE.DirectionalLight().shadow.camera;

describe('fitSceneDirectionalShadows', () => {
  it('fits a declared, casting light to the camera', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true });
    fitSceneDirectionalShadows(scene, viewingCamera());
    const shadowCamera = light.shadow.camera;
    expect(shadowCamera.right - shadowCamera.left).toBeGreaterThan(80);
    const threeDepth = shadowCamera.far - shadowCamera.near;
    const godotDepth = (threeDepth - DECLARATION.pancakeSize) / 2 + DECLARATION.pancakeSize;
    expect(light.shadow.bias).toBeCloseTo((DECLARATION.depthBias * godotDepth) / threeDepth, 12);
  });

  it('leaves a light without a declaration alone', () => {
    const { scene, light } = sceneWithSun({ declared: false, casts: true });
    fitSceneDirectionalShadows(scene, viewingCamera());
    expect(light.shadow.camera.left).toBe(UNFITTED.left);
    expect(light.shadow.camera.far).toBe(UNFITTED.far);
    expect(light.shadow.bias).toBe(0);
  });

  it('leaves a declared light that casts no shadow alone (edge case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: false, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    expect(light.shadow.camera.left).toBe(UNFITTED.left);
    expect(splitSunOf(light)).toBeNull();
  });

  it('fits nothing for a camera without a depth range (error case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true });
    fitSceneDirectionalShadows(scene, new THREE.Camera());
    expect(light.shadow.camera.left).toBe(UNFITTED.left);
  });

  it('follows the camera when it moves', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true });
    const camera = viewingCamera();
    fitSceneDirectionalShadows(scene, camera);
    const before = light.shadow.camera.left;
    camera.position.x += 500;
    camera.updateMatrixWorld();
    fitSceneDirectionalShadows(scene, camera);
    expect(light.shadow.camera.left).not.toBeCloseTo(before, 3);
  });
});

describe('fitSceneDirectionalShadows with splits', () => {
  it('shades a split light through a sun that takes its colour and intensity', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    const sun = splitSunOf(light);
    expect(sun?.color.getHex()).toBe(0xff8000);
    expect(sun?.intensity).toBe(3);
    expect(sun?.castShadow).toBe(true);
  });

  it('hides the declared light from the render and keeps its layers on the sun', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    const camera = viewingCamera();
    fitSceneDirectionalShadows(scene, camera);
    expect(light.layers.test(camera.layers)).toBe(false);
    expect(splitSunOf(light)?.layers.test(camera.layers)).toBe(true);
  });

  it('points the sun from the light’s target towards the light, as three points the light', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 2 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    const direction = new THREE.Vector3().setFromMatrixPosition(splitSunOf(light)!.matrixWorld);
    expect(direction.toArray()).toEqual([10, 20, 5]);
  });

  it('keeps the sun’s direction through a scene update (edge case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    scene.updateMatrixWorld(true);
    const direction = new THREE.Vector3().setFromMatrixPosition(splitSunOf(light)!.matrixWorld);
    expect(direction.toArray()).toEqual([10, 20, 5]);
  });

  it('attaches one sun however often it fits', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    fitSceneDirectionalShadows(scene, viewingCamera());
    expect(light.children).toHaveLength(1);
  });

  it('fits one camera per split, nearest the narrowest', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    const shadow = splitSunOf(light)!.shadow;
    const widths = [0, 1, 2, 3].map((split) => shadow.getCamera(split).right - shadow.getCamera(split).left);
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
  });

  it('writes each split’s far end into its slot', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    const ends = splitSunOf(light)!.shadow._cascadeData.map((slot) => slot.x);
    [8.045, 16.04, 40.025, 80].forEach((end, i) => expect(ends[i]).toBeCloseTo(end, 9));
  });

  it('hands the light its own shading back when it goes orthogonal', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    const camera = viewingCamera();
    fitSceneDirectionalShadows(scene, camera);
    light.userData = directionalShadowUserData(DECLARATION);
    fitSceneDirectionalShadows(scene, camera);
    expect(splitSunOf(light)).toBeNull();
    expect(light.layers.test(camera.layers)).toBe(true);
    expect(light.shadow.camera.left).not.toBe(UNFITTED.left);
  });

  it('attaches no sun while no split gets a finite box (error case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    const camera = viewingCamera();
    camera.projectionMatrixInverse.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    fitSceneDirectionalShadows(scene, camera);
    expect(splitSunOf(light)).toBeNull();
    expect(light.layers.test(camera.layers)).toBe(true);
  });

  it('keeps the last fitted splits through a fit that fails (edge case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    const camera = viewingCamera();
    fitSceneDirectionalShadows(scene, camera);
    const fitted = splitSunOf(light)!.shadow.getCamera(0).left;
    camera.projectionMatrixInverse.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    fitSceneDirectionalShadows(scene, camera);
    expect(splitSunOf(light)!.shadow.getCamera(0).left).toBe(fitted);
  });

  it('hands the light its own shading back when it stops casting (edge case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    light.castShadow = false;
    fitSceneDirectionalShadows(scene, viewingCamera());
    expect(splitSunOf(light)).toBeNull();
  });
});

describe('releaseSceneSplitSuns', () => {
  it('releases every split sun in the scene', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    releaseSceneSplitSuns(scene);
    expect(splitSunOf(light)).toBeNull();
    expect(light.layers.isEnabled(0)).toBe(true);
  });

  it('leaves a scene without split suns as it is (edge case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true });
    releaseSceneSplitSuns(scene);
    expect(light.children).toHaveLength(0);
    expect(light.layers.isEnabled(0)).toBe(true);
  });

  it('leaves an undeclared light’s layers alone (error case)', () => {
    const { scene, light } = sceneWithSun({ declared: false, casts: true });
    light.layers.set(3);
    releaseSceneSplitSuns(scene);
    expect(light.layers.mask).toBe(1 << 3);
  });
});

describe('fitSceneDirectionalShadows fades', () => {
  function lastFades() {
    return writtenFades.mock.lastCall![0];
  }

  it('fades an orthogonal light out over the far end of its slice', () => {
    const { scene } = sceneWithSun({ declared: true, casts: true });
    fitSceneDirectionalShadows(scene, viewingCamera());
    const [fade] = lastFades().directional;
    expect(fade!.from).toBeCloseTo(DECLARATION.maxDistance * DECLARATION.fadeStart, 12);
    expect(fade!.to).toBe(DECLARATION.maxDistance);
    expect(lastFades().sun).toEqual([]);
  });

  it('fades a split light through its sun, over the far end of its last split', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    fitSceneDirectionalShadows(scene, viewingCamera());
    const lastSplitEnd = splitSunOf(light)!.shadow._cascadeData[3]!.x;
    expect(lastFades().directional).toEqual([]);
    expect(lastFades().sun).toEqual([{ from: expect.closeTo(lastSplitEnd * DECLARATION.fadeStart, 12), to: lastSplitEnd }]);
    expect(lastSplitEnd).toBe(DECLARATION.maxDistance);
  });

  it('fades a split light that goes orthogonal as a directional shadow again (edge case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true, splitCount: 2 });
    const camera = viewingCamera();
    fitSceneDirectionalShadows(scene, camera);
    light.userData = directionalShadowUserData(DECLARATION);
    fitSceneDirectionalShadows(scene, camera);
    expect(lastFades().sun).toEqual([]);
    expect(lastFades().directional).toHaveLength(1);
  });

  it('keeps an undeclared caster’s index with no fade', () => {
    const { scene } = sceneWithSun({ declared: true, casts: true });
    const undeclared = new THREE.DirectionalLight();
    undeclared.castShadow = true;
    scene.children.unshift(undeclared);
    fitSceneDirectionalShadows(scene, viewingCamera());
    const { directional } = lastFades();
    expect(directional).toHaveLength(2);
    expect(directional[0]).toBeNull();
    expect(directional[1]).not.toBeNull();
  });

  it('writes no fade for a split light whose splits get no finite box (error case)', () => {
    const { scene } = sceneWithSun({ declared: true, casts: true, splitCount: 4 });
    const camera = viewingCamera();
    camera.projectionMatrixInverse.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    fitSceneDirectionalShadows(scene, camera);
    // No sun attaches, so the declared light casts its own unfitted, unfaded shadow.
    expect(lastFades()).toEqual({ directional: [null], sun: [] });
  });

  it('clears every fade for a camera without a depth range (error case)', () => {
    const { scene } = sceneWithSun({ declared: true, casts: true });
    fitSceneDirectionalShadows(scene, new THREE.Camera());
    expect(writtenFades).toHaveBeenLastCalledWith({ directional: [], sun: [] });
  });

  it('writes empty lists for a scene with no caster (edge case)', () => {
    const { scene } = sceneWithSun({ declared: true, casts: false });
    fitSceneDirectionalShadows(scene, viewingCamera());
    expect(writtenFades).toHaveBeenLastCalledWith({ directional: [], sun: [] });
  });
});

/**
 * The lights `WebGLRenderer.projectObject` hands `WebGLLights.setup`: visible pre-order, a light
 * only where the camera's layers include it, and the children of any visible object (three r186
 * `WebGLRenderer.js:1859-1888`).
 */
function threeRenderLights(object: THREE.Object3D, camera: THREE.Camera, lights: THREE.Light[] = []): THREE.Light[] {
  if (!object.visible) return lights;
  const light = object as THREE.Light;
  if (light.isLight && object.layers.test(camera.layers)) lights.push(light);
  for (const child of object.children) threeRenderLights(child, camera, lights);
  return lights;
}

describe('fitSceneDirectionalShadows fade order against three', () => {
  it('writes each fade at the shadow index three gives its light, with a split and an orthogonal light', () => {
    const scene = new THREE.Scene();
    const unlit = new THREE.DirectionalLight();
    const spot = new THREE.SpotLight();
    spot.castShadow = true;
    const split = new THREE.DirectionalLight();
    split.castShadow = true;
    split.userData = directionalShadowUserData({ ...DECLARATION, maxDistance: 50, splitCount: 4 });
    const orthogonal = new THREE.DirectionalLight();
    orthogonal.castShadow = true;
    orthogonal.userData = directionalShadowUserData(DECLARATION);
    split.position.set(10, 20, 5);
    orthogonal.position.set(-10, 20, 5);
    scene.add(unlit, spot, split, split.target, orthogonal, orthogonal.target);
    scene.updateMatrixWorld();
    const camera = viewingCamera();
    fitSceneDirectionalShadows(scene, camera);

    const three = new WebGLLights({ has: () => false } as unknown as WebGLExtensions);
    three.setup(threeRenderLights(scene, camera));
    const sun = splitSunOf(split)!;
    expect(three.state.directionalShadowMatrix).toEqual([orthogonal.shadow.matrix]);
    expect(three.state.sunShadowCascade[0]).toBe(sun.shadow._cascadeData[0]);
    expect(three.state.sunShadow).toHaveLength(1);

    const { directional, sun: sunFades } = writtenFades.mock.lastCall![0];
    expect(directional).toEqual([{ from: expect.closeTo(64, 12), to: 80 }]);
    expect(sunFades).toEqual([{ from: expect.closeTo(40, 12), to: 50 }]);
  });

  it('keeps three’s pre-order across several orthogonal lights (edge case)', () => {
    const scene = new THREE.Scene();
    const lights = [80, 60, 40].map((maxDistance) => {
      const light = new THREE.DirectionalLight();
      light.castShadow = true;
      light.userData = directionalShadowUserData({ ...DECLARATION, maxDistance });
      return light;
    });
    const group = new THREE.Group();
    group.add(lights[1]!);
    scene.add(new THREE.DirectionalLight(), lights[0]!, group, lights[2]!);
    scene.updateMatrixWorld();
    const camera = viewingCamera();
    fitSceneDirectionalShadows(scene, camera);

    const three = new WebGLLights({ has: () => false } as unknown as WebGLExtensions);
    three.setup(threeRenderLights(scene, camera));
    const byIndex = three.state.directionalShadowMatrix.map((matrix) =>
      lights.find((light) => light.shadow.matrix === matrix)
    );
    const fadeEnds = writtenFades.mock.lastCall![0].directional.map((fade) => fade!.to);
    expect(fadeEnds).toEqual(byIndex.map((light) => readDeclaredMaxDistance(light!)));
  });
});

function readDeclaredMaxDistance(light: THREE.DirectionalLight): number {
  return (light.userData.directionalShadow as DirectionalShadowDeclaration).maxDistance;
}

describe('directionalShadowCasters', () => {
  function caster(): THREE.DirectionalLight {
    const light = new THREE.DirectionalLight();
    light.castShadow = true;
    return light;
  }

  it('lists casters in scene pre-order, as three indexes their shadows', () => {
    const scene = new THREE.Scene();
    const [first, nested, last] = [caster(), caster(), caster()];
    const group = new THREE.Group();
    group.add(nested);
    scene.add(first, group, last);
    expect(directionalShadowCasters(scene, viewingCamera())).toEqual({ directional: [first, nested, last], sun: [] });
  });

  it('lists a split sun apart from the directional lights', () => {
    const scene = new THREE.Scene();
    const directional = caster();
    const sun = new SplitSunLight();
    scene.add(sun, directional);
    expect(directionalShadowCasters(scene, viewingCamera())).toEqual({ directional: [directional], sun: [sun] });
  });

  it('skips a light three draws no shadow for: non-casting, hidden, or on another layer', () => {
    const scene = new THREE.Scene();
    const nonCasting = new THREE.DirectionalLight();
    const hidden = caster();
    hidden.visible = false;
    const otherLayer = caster();
    otherLayer.layers.set(5);
    const drawn = caster();
    scene.add(nonCasting, hidden, otherLayer, drawn);
    expect(directionalShadowCasters(scene, viewingCamera()).directional).toEqual([drawn]);
  });

  it('lists the sun under a declared light the layer test hides (edge case)', () => {
    const scene = new THREE.Scene();
    const hiddenParent = caster();
    hiddenParent.layers.disableAll();
    const sun = new SplitSunLight();
    hiddenParent.add(sun);
    scene.add(hiddenParent);
    expect(directionalShadowCasters(scene, viewingCamera())).toEqual({ directional: [], sun: [sun] });
  });

  it('skips every light under a hidden parent (edge case)', () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    parent.visible = false;
    parent.add(caster(), new SplitSunLight());
    scene.add(parent);
    expect(directionalShadowCasters(scene, viewingCamera())).toEqual({ directional: [], sun: [] });
  });
});
