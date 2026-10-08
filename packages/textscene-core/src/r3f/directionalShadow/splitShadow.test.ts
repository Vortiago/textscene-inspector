/**
 * The atlas is checked through the matrices three samples with: a split is right when its matrix
 * maps its own slice into its own rectangle of the atlas, in texture coordinates.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { DirectionalSplitShadow, SPLIT_CAMERA_UP, SPLIT_SLOTS } from './splitShadow';
import { directionalShadowAtlasDepth } from './shadowAtlas';
import { directionalShadowUserData } from './declaration';
import { fitSceneDirectionalShadows } from './fitSceneDirectionalShadows';
import { sceneLights } from './lightLists';
import { cameraSliceCorners } from './fitDirectionalShadowBox';
import { splitSunOf } from './splitSun';
import {
  directionalShadowSplitAtlasRect,
  type DirectionalShadowAtlasRect,
} from '../../godot/directionalShadow';

const ATLAS_SIZE = 4096;
const WHOLE_ATLAS = { x: 0, y: 0, width: ATLAS_SIZE, height: ATLAS_SIZE };
/** The second of two lights' shares: half the atlas's width at its full height. */
const SECOND_OF_TWO = { x: 2048, y: 0, width: 2048, height: ATLAS_SIZE };
/** The last of three or four lights' shares: a quarter of the atlas. */
const QUARTER = { x: 2048, y: 2048, width: 2048, height: 2048 };
const FACE_TOLERANCE = 1e-9;

function viewingCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 4000);
  camera.position.set(0, 10, 40);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function declaredSplitLight(splitCount: number): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight();
  light.position.set(10, 20, 5);
  light.castShadow = true;
  light.userData = directionalShadowUserData({
    maxDistance: 80,
    pancakeSize: 20,
    fadeStart: 0.8,
    depthBias: 0,
    normalBias: 2,
    filterRadius: 2,
    splitCount,
    splitOffsets: [0.1, 0.2, 0.5],
    blendSplits: false,
    sharesAtlas: true,
  });
  return light;
}

/**
 * The split shadow of the last of `lightCount` split lights fitted to `camera`, its matrices
 * updated as the shadow pass does.
 */
function fittedShadow(
  camera: THREE.PerspectiveCamera,
  splitCount: number,
  lightCount = 1
): DirectionalSplitShadow {
  const scene = new THREE.Scene();
  const lights = Array.from({ length: lightCount }, () => declaredSplitLight(splitCount));
  for (const light of lights) scene.add(light, light.target);
  scene.updateMatrixWorld();
  fitSceneDirectionalShadows(scene, camera, sceneLights(scene));
  const sun = splitSunOf(lights[lightCount - 1]!)!;
  sun.shadow.updateMatrices(sun);
  return sun.shadow;
}

/** Whether `point` lands inside `rect` of the atlas, in its texture coordinates, and inside its depth. */
function landsIn(matrix: THREE.Matrix4, point: THREE.Vector3, rect: DirectionalShadowAtlasRect): boolean {
  const mapped = point.clone().applyMatrix4(matrix);
  const within = (value: number, start: number, size: number) =>
    value >= start / ATLAS_SIZE - FACE_TOLERANCE && value <= (start + size) / ATLAS_SIZE + FACE_TOLERANCE;
  return (
    within(mapped.x, rect.x, rect.width) &&
    within(mapped.y, rect.y, rect.height) &&
    mapped.z >= -FACE_TOLERANCE &&
    mapped.z <= 1 + FACE_TOLERANCE
  );
}

const nothing = new THREE.Sphere(new THREE.Vector3(), 1e6);

describe('DirectionalSplitShadow.setSplits', () => {
  it('lays four splits out as quadrants of the atlas', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, WHOLE_ATLAS);
    expect(shadow.mapSize.toArray()).toEqual([2048, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([2, 2]);
    expect(shadow.getViewport(3).toArray()).toEqual([1, 1, 1, 1]);
  });

  it('lays two splits out as halves of the atlas height, drawing nothing in the last slots', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(2, WHOLE_ATLAS);
    expect(shadow.mapSize.toArray()).toEqual([4096, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([1, 2]);
    expect(shadow.getViewport(1).toArray()).toEqual([0, 1, 1, 1]);
    expect(shadow.getViewport(2).toArray()).toEqual([0, 0, 0, 0]);
  });

  it('lays four splits out as quadrants of a light’s share of the atlas, which is not square', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, SECOND_OF_TWO);
    expect(shadow.mapSize.toArray()).toEqual([1024, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([4, 2]);
    expect(shadow.getViewport(1).toArray()).toEqual([3, 0, 1, 1]);
    expect(shadow.getViewport(3).toArray()).toEqual([3, 1, 1, 1]);
  });

  it('lays two splits out as halves of a light’s share of the atlas', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(2, SECOND_OF_TWO);
    expect(shadow.mapSize.toArray()).toEqual([2048, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([2, 2]);
    expect(shadow.getViewport(1).toArray()).toEqual([1, 1, 1, 1]);
  });

  it('lays one split out as the light’s whole share, drawing nothing in the other slots', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(1, SECOND_OF_TWO);
    expect(shadow.mapSize.toArray()).toEqual([2048, 4096]);
    expect(shadow.getFrameExtents().toArray()).toEqual([2, 1]);
    expect(shadow.getViewport(0).toArray()).toEqual([1, 0, 1, 1]);
    expect(shadow.getViewport(1).toArray()).toEqual([0, 0, 0, 0]);
  });

  it('draws into the one atlas every lit material samples', () => {
    const shadow = new DirectionalSplitShadow();
    expect(shadow.map?.depthTexture).toBe(directionalShadowAtlasDepth());
  });

  it('asks three for the atlas’s own size from any share, so three never resizes it (edge case)', () => {
    // three resizes a map whose size no longer matches `mapSize` × the frame extents (r186
    // `WebGLShadowMap.js:281-285`).
    const shadow = new DirectionalSplitShadow();
    for (const splitCount of [1, 2, 4]) {
      for (const share of [WHOLE_ATLAS, SECOND_OF_TWO, QUARTER]) {
        shadow.setSplits(splitCount, share);
        expect(shadow.mapSize.clone().multiply(shadow.getFrameExtents()).toArray()).toEqual([4096, 4096]);
      }
    }
  });

  it('writes back the split size three shrank, when the layout is unchanged (edge case)', () => {
    // three shrinks `mapSize` when the atlas exceeds `MAX_TEXTURE_SIZE` (r186 `WebGLShadowMap.js:180-198`).
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, SECOND_OF_TWO);
    shadow.mapSize.set(512, 1024);
    shadow.setSplits(4, SECOND_OF_TWO);
    expect(shadow.mapSize.toArray()).toEqual([1024, 2048]);
    expect(shadow.getViewport(1).toArray()).toEqual([3, 0, 1, 1]);
  });

  it('lays the splits out again when the share moves (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, WHOLE_ATLAS);
    shadow.setSplits(4, { ...WHOLE_ATLAS, x: 2048, width: 2048 });
    expect(shadow.mapSize.toArray()).toEqual([1024, 2048]);
    expect(shadow.getViewport(1).toArray()).toEqual([3, 0, 1, 1]);
  });

  it('lays the splits out again when the split count changes (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, WHOLE_ATLAS);
    shadow.setSplits(2, WHOLE_ATLAS);
    expect(shadow.mapSize.toArray()).toEqual([4096, 2048]);
    expect(shadow.getViewport(2).toArray()).toEqual([0, 0, 0, 0]);
  });

  it('keeps four slots for every split count, as the shader expects (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(2, WHOLE_ATLAS);
    expect(shadow.getViewportCount()).toBe(SPLIT_SLOTS);
  });

  it('draws nothing into any slot for a count with no split (error case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(0, WHOLE_ATLAS);
    expect(() => shadow.updateMatrices(new THREE.DirectionalLight())).not.toThrow();
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      expect(shadow.getFrustum(slot).intersectsSphere(nothing)).toBe(false);
    }
  });
});

describe('DirectionalSplitShadow.updateMatrices', () => {
  it('maps each of four splits’ slices into its own quadrant', () => {
    const camera = viewingCamera();
    const shadow = fittedShadow(camera, 4);
    const starts = [0.05, 8.045, 16.04, 40.025];
    const ends = [8.045, 16.04, 40.025, 80];
    for (let split = 0; split < 4; split++) {
      const rect = directionalShadowSplitAtlasRect(4, split, WHOLE_ATLAS);
      for (const corner of cameraSliceCorners(camera, starts[split]!, ends[split]!)) {
        expect(landsIn(shadow.getMatrix(split), corner, rect)).toBe(true);
      }
    }
  });

  it('maps each of two splits’ slices into its own half', () => {
    const camera = viewingCamera();
    const shadow = fittedShadow(camera, 2);
    const rect = directionalShadowSplitAtlasRect(2, 1, WHOLE_ATLAS);
    for (const corner of cameraSliceCorners(camera, 8.045, 80)) {
      expect(landsIn(shadow.getMatrix(1), corner, rect)).toBe(true);
    }
  });

  it('maps each of four splits’ slices into its own quadrant of a light’s share of the atlas', () => {
    const camera = viewingCamera();
    const shadow = fittedShadow(camera, 4, 2);
    const starts = [0.05, 8.045, 16.04, 40.025];
    const ends = [8.045, 16.04, 40.025, 80];
    for (let split = 0; split < 4; split++) {
      const rect = directionalShadowSplitAtlasRect(4, split, SECOND_OF_TWO);
      for (const corner of cameraSliceCorners(camera, starts[split]!, ends[split]!)) {
        expect(landsIn(shadow.getMatrix(split), corner, rect)).toBe(true);
      }
    }
  });

  it('maps an orthogonal light’s slice into its share of the atlas', () => {
    const camera = viewingCamera();
    const shadow = fittedShadow(camera, 1, 2);
    for (const corner of cameraSliceCorners(camera, 0.05, 80)) {
      expect(landsIn(shadow.getMatrix(0), corner, SECOND_OF_TWO)).toBe(true);
    }
  });

  it('repeats the last split’s matrix in the undrawn slots (edge case)', () => {
    const shadow = fittedShadow(viewingCamera(), 2);
    expect(shadow.getMatrix(3).equals(shadow.getMatrix(1))).toBe(true);
  });

  it('culls every caster from an undrawn slot', () => {
    const shadow = fittedShadow(viewingCamera(), 2);
    expect(shadow.getFrustum(1).intersectsSphere(new THREE.Sphere(new THREE.Vector3(), 1))).toBe(true);
    expect(shadow.getFrustum(2).intersectsSphere(nothing)).toBe(false);
  });

  it('culls a caster from an undrawn slot without reading its bounds (edge case)', () => {
    // three's shadow pass asks each caster through `intersectsObject` (r186 `Mesh.js:228`).
    const shadow = fittedShadow(viewingCamera(), 2);
    const caster = new THREE.Mesh(new THREE.BoxGeometry());
    const bounds = vi.spyOn(caster.geometry, 'computeBoundingSphere');
    expect(shadow.getFrustum(3).intersectsObject(caster)).toBe(false);
    expect(shadow.getFrustum(1).intersectsObject(caster)).toBe(true);
    expect(bounds).toHaveBeenCalledOnce();
  });

  it('rebuilds a split’s projection when three reverses the depth buffer (edge case)', () => {
    const shadow = fittedShadow(viewingCamera(), 4);
    const forwardDepth = shadow.getCamera(0).projectionMatrix.clone();
    (shadow.camera as unknown as { _reversedDepth: boolean })._reversedDepth = true;
    shadow.updateMatrices(new THREE.DirectionalLight());
    expect(shadow.getCamera(0).reversedDepth).toBe(true);
    expect(shadow.getCamera(0).projectionMatrix.equals(forwardDepth)).toBe(false);
  });

  it('rolls every split camera by the up the fitter fits with (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      expect(shadow.getCamera(slot).up.equals(SPLIT_CAMERA_UP)).toBe(true);
    }
  });
});

describe('DirectionalSplitShadow share of the atlas', () => {
  it('scissors the atlas to its light’s share before three clears and draws it', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, SECOND_OF_TWO);
    shadow.updateMatrices(new THREE.DirectionalLight());
    expect(shadow.map!.scissor.toArray()).toEqual([2048, 0, 2048, 4096]);
    expect(shadow.map!.scissorTest).toBe(true);
  });

  it('moves the scissor to each light’s share in turn, as three draws one light after another', () => {
    const [first, second] = [new DirectionalSplitShadow(), new DirectionalSplitShadow()];
    first.setSplits(1, WHOLE_ATLAS);
    second.setSplits(2, QUARTER);
    first.updateMatrices(new THREE.DirectionalLight());
    expect(first.map!.scissor.toArray()).toEqual([0, 0, 4096, 4096]);
    second.updateMatrices(new THREE.DirectionalLight());
    expect(second.map!.scissor.toArray()).toEqual([2048, 2048, 2048, 2048]);
  });

  it('scales the scissor with a map size three shrank to fit the GPU (edge case)', () => {
    // three shrinks `mapSize` when the atlas exceeds `MAX_TEXTURE_SIZE` (r186 `WebGLShadowMap.js:180-198`).
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, SECOND_OF_TWO);
    shadow.mapSize.set(512, 1024);
    shadow.updateMatrices(new THREE.DirectionalLight());
    expect(shadow.map!.scissor.toArray()).toEqual([1024, 0, 1024, 2048]);
  });

  it('lets go of the atlas on dispose without freeing it for the shadows that still draw', () => {
    const [kept, disposed] = [new DirectionalSplitShadow(), new DirectionalSplitShadow()];
    const freed = vi.fn();
    const atlas = kept.map!;
    atlas.addEventListener('dispose', freed);
    disposed.dispose();
    expect(disposed.map).toBeNull();
    expect(freed).not.toHaveBeenCalled();
    kept.dispose();
    atlas.removeEventListener('dispose', freed);
  });

  it('scissors nothing once disposed (error case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(1, WHOLE_ATLAS);
    shadow.dispose();
    expect(() => shadow.updateMatrices(new THREE.DirectionalLight())).not.toThrow();
  });
});

/** three's own module source. Its exports map exposes `"./src/*"`. */
function threeSource(path: string): string {
  return readFileSync(createRequire(import.meta.url).resolve(`three/src/${path}`), 'utf8');
}

/** The source between the first `from` and the next `to` after it, or null when either is missing. */
function between(source: string, from: string, to: string): string | null {
  const start = source.indexOf(from);
  const end = start < 0 ? -1 : source.indexOf(to, start);
  return end < 0 ? null : source.slice(start, end + to.length);
}

describe('three’s shadow pass, as the shared atlas relies on it', () => {
  const shadowPass = threeSource('renderers/webgl/WebGLShadowMap.js');

  it('builds a map only for a shadow that has none, so every shadow keeps the atlas', () => {
    expect(shadowPass).toContain('if ( shadow.map === null || typeChanged === true ) {');
  });

  it('asks each shadow for its matrices before it binds and clears that shadow’s map', () => {
    const bind = 'renderer.setRenderTarget( shadow.map );';
    expect(between(shadowPass, 'shadow.updateMatrices( light, camera );', bind)).not.toBeNull();
    expect(between(shadowPass, bind, 'renderer.clear();')).toMatch(
      /^\S+\(\s*shadow\.map\s*\);\s*renderer\.clear\(\);$/
    );
  });

  it('binds a render target with that target’s own scissor', () => {
    // The last copy is the path every target takes. The one before it serves an XR framebuffer.
    const renderer = threeSource('renderers/WebGLRenderer.js');
    const copy = '_currentScissor.copy( renderTarget.scissor );';
    const binding = between(
      renderer.slice(renderer.lastIndexOf(copy)),
      copy,
      'state.setScissorTest( _currentScissorTest );'
    );
    expect(binding).toContain('_currentScissorTest = renderTarget.scissorTest;');
    expect(binding).toContain('state.scissor( _currentScissor );');
  });

  it('sizes each map from its map size and frame extents (edge case)', () => {
    expect(shadowPass).toContain('_shadowMapSize.copy( shadow.mapSize );');
    expect(shadowPass).toContain('_shadowMapSize.multiply( shadowFrameExtents );');
  });
});

describe('DirectionalSplitShadow.holdsBox', () => {
  /** A shadow of one split whose frustum is a 2-unit cube about the origin. */
  function oneSplitAboutOrigin(): DirectionalSplitShadow {
    const shadow = new DirectionalSplitShadow();
    shadow.splitCount = 1;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    camera.updateMatrixWorld();
    shadow
      .getFrustum(0)
      .setFromProjectionMatrix(camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse));
    return shadow;
  }

  it('holds a box inside a drawn split', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
    expect(oneSplitAboutOrigin().holdsBox(box)).toBe(true);
  });

  it('does not hold a box outside every drawn split', () => {
    const box = new THREE.Box3(new THREE.Vector3(5, 5, 5), new THREE.Vector3(6, 6, 6));
    expect(oneSplitAboutOrigin().holdsBox(box)).toBe(false);
  });

  it('holds nothing when no split draws', () => {
    const shadow = oneSplitAboutOrigin();
    shadow.splitCount = 0;
    expect(shadow.holdsBox(new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()))).toBe(false);
  });
});
