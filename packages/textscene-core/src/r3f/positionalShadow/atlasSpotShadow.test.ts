import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { AtlasSpotShadow } from './atlasSpotShadow';
import { holdPositionalShadowAtlas, positionalShadowAtlas } from './shadowAtlasTarget';

// The tests read the atlas at the root viewport's size.
holdPositionalShadowAtlas({}, 4096);

/** A spot light 3 units over the origin, aimed down its own -Z, which points down the world's -Y. */
function downwardSpot(): THREE.SpotLight {
  const light = new THREE.SpotLight(0xffffff, 1, 8, Math.PI / 4);
  light.position.set(0, 3, 0);
  light.rotation.x = -Math.PI / 2;
  light.updateMatrixWorld();
  light.target.position.set(0, 0, 0);
  light.target.updateMatrixWorld();
  return light;
}

/** The atlas coordinate a world point maps to through the shadow's matrix. */
function atlasCoord(shadow: AtlasSpotShadow, point: THREE.Vector3): THREE.Vector3 {
  const v = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(shadow.matrix);
  return new THREE.Vector3(v.x / v.w, v.y / v.w, v.z / v.w);
}

describe('AtlasSpotShadow.place', () => {
  it('asks three for the atlas’s own size, with the slot as one viewport of it', () => {
    const shadow = new AtlasSpotShadow();
    shadow.place({ x: 2048, y: 1024, size: 1024, paraboloidStep: null });
    expect(shadow.map).toBe(positionalShadowAtlas());
    expect(shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(shadow.getFrameExtents().toArray()).toEqual([4, 4]);
    expect(shadow.getViewport(0).toArray()).toEqual([2, 1, 1, 1]);
  });

  it('leaves the shadow as it is for a null slot (edge case)', () => {
    const shadow = new AtlasSpotShadow();
    shadow.place({ x: 2048, y: 1024, size: 1024, paraboloidStep: null });
    shadow.place(null);
    expect(shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(shadow.getViewport(0).toArray()).toEqual([2, 1, 1, 1]);
  });

  it('takes the atlas again after a dispose let it go (edge case)', () => {
    const shadow = new AtlasSpotShadow();
    shadow.dispose();
    shadow.place({ x: 0, y: 0, size: 512, paraboloidStep: null });
    expect(shadow.map).toBe(positionalShadowAtlas());
  });
});

describe('AtlasSpotShadow.updateMatrices', () => {
  it('maps the cone’s axis to the centre of the light’s slot in the atlas', () => {
    const shadow = new AtlasSpotShadow();
    shadow.place({ x: 2048, y: 1024, size: 1024, paraboloidStep: null });
    shadow.updateMatrices(downwardSpot());
    const centre = atlasCoord(shadow, new THREE.Vector3(0, 0, 0));
    expect(centre.x).toBeCloseTo((2048 + 512) / 4096, 9);
    expect(centre.y).toBeCloseTo((1024 + 512) / 4096, 9);
  });

  it('turns the shadow camera with the light’s own axes, as Godot does', () => {
    const light = downwardSpot();
    light.rotation.z = Math.PI / 6;
    light.updateMatrixWorld();
    const shadow = new AtlasSpotShadow();
    shadow.place({ x: 0, y: 0, size: 1024, paraboloidStep: null });
    shadow.updateMatrices(light);
    const lightRotation = new THREE.Quaternion().setFromRotationMatrix(light.matrixWorld);
    expect(shadow.camera.quaternion.angleTo(lightRotation)).toBeCloseTo(0, 6);
  });

  it('scissors the atlas to the slot before three clears and draws it', () => {
    const shadow = new AtlasSpotShadow();
    shadow.place({ x: 2048, y: 1024, size: 1024, paraboloidStep: null });
    shadow.updateMatrices(downwardSpot());
    expect(shadow.map!.scissor.toArray()).toEqual([2048, 1024, 1024, 1024]);
    expect(shadow.map!.scissorTest).toBe(true);
  });

  it('scales the scissor with a map size three shrank to fit the GPU (edge case)', () => {
    // three shrinks `mapSize` when the atlas exceeds `MAX_TEXTURE_SIZE` (r186 `WebGLShadowMap.js:180-198`).
    const shadow = new AtlasSpotShadow();
    shadow.place({ x: 2048, y: 1024, size: 1024, paraboloidStep: null });
    shadow.mapSize.set(512, 512);
    shadow.updateMatrices(downwardSpot());
    expect(shadow.map!.scissor.toArray()).toEqual([1024, 512, 512, 512]);
  });

  it('scissors nothing once disposed (error case)', () => {
    const shadow = new AtlasSpotShadow();
    shadow.dispose();
    expect(shadow.map).toBeNull();
    expect(() => shadow.updateMatrices(downwardSpot())).not.toThrow();
  });
});

/** three's own module source. Its exports map exposes `"./src/*"`. */
function threeSource(path: string): string {
  return readFileSync(createRequire(import.meta.url).resolve(`three/src/${path}`), 'utf8');
}

describe('three’s spot shadow, as the atlas relies on it', () => {
  it('builds the projection before it maps the whole map, which the slot’s matrix then replaces', () => {
    const spot = threeSource('lights/SpotLightShadow.js');
    expect(spot).toContain('camera.updateProjectionMatrix();');
    expect(spot).toContain('super.updateMatrices( light );');
    const base = threeSource('lights/LightShadow.js');
    expect(base).toContain('_updateMatrix( shadowCamera, shadowMatrix, frustum, viewport ) {');
    expect(base).toContain('const offsetX = viewport ? viewport.x / frameExtents.x : 0;');
  });

  it('draws one viewport of a 2D map at the viewport’s offset in units of the map size', () => {
    const pass = threeSource('renderers/webgl/WebGLShadowMap.js');
    expect(pass).toContain('if ( light.isPointLight !== true ) shadow.updateMatrices( light, camera );');
    expect(pass).toContain('_viewportSize.x * viewport.x,');
  });
});
