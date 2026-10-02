/**
 * The pass runs inside three's renderer, which happy-dom cannot run, so a stand-in renderer records
 * what the wrapped pass does. The last block reads three's own source, so a release that moves what
 * the pass relies on fails here and not in a golden.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { AtlasOmniShadow } from './atlasOmniShadow';
import { framebufferHeight } from '../shadowFilter/framebufferRows';
import { OmniShadowCopy } from './omniShadowCopy';
import { installPositionalShadowPass } from './positionalShadowPass';
import { holdPositionalShadowAtlas } from './shadowAtlasTarget';

holdPositionalShadowAtlas({}, 4096);

/** A renderer whose shadow pass and render target the wrapped pass reads. */
function fakeRenderer(): { renderer: THREE.WebGLRenderer; threePass: ReturnType<typeof vi.fn> } {
  const threePass = vi.fn();
  const target = new THREE.WebGLRenderTarget(64, 48);
  const renderer = {
    shadowMap: { enabled: true, autoUpdate: true, needsUpdate: false, render: threePass },
    getRenderTarget: vi.fn(() => target),
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: vi.fn(),
    getDrawingBufferSize: (size: THREE.Vector2) => size.set(955, 756),
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, threePass };
}

/** An omni light that holds a slot in the atlas, or none. */
function omniLight(hasSlot = true): THREE.PointLight {
  const light = new THREE.PointLight();
  const shadow = new AtlasOmniShadow();
  shadow.fitCube(256);
  shadow.slot = hasSlot ? { x: 0, y: 0, size: 512, paraboloidStep: [1, 0] } : null;
  light.shadow = shadow;
  light.updateMatrixWorld();
  return light;
}

const runPass = (renderer: THREE.WebGLRenderer, lights: THREE.Light[]) =>
  renderer.shadowMap.render(lights, new THREE.Scene(), new THREE.PerspectiveCamera());

describe('installPositionalShadowPass', () => {
  it('runs three’s pass, then copies each omni light that holds a slot', () => {
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => {});
    const { renderer, threePass } = fakeRenderer();
    installPositionalShadowPass(renderer);
    const [held, unheld] = [omniLight(), omniLight(false)];
    const spot = new THREE.SpotLight();
    runPass(renderer, [held, unheld, spot]);
    expect(threePass).toHaveBeenCalledOnce();
    expect(copy.mock.calls.map(([, light]) => light)).toEqual([held]);
    expect(held.shadow.matrix.elements[11]).toBe(512 / 4096);
    copy.mockRestore();
  });

  it('restores the render target the draw goes to, and records its height', () => {
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => {});
    const { renderer } = fakeRenderer();
    installPositionalShadowPass(renderer);
    runPass(renderer, [omniLight()]);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(renderer.getRenderTarget(), 0, 0);
    expect(framebufferHeight[0]).toBe(48);
    copy.mockRestore();
  });

  it('copies nothing that three’s pass did not draw (edge case)', () => {
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => {});
    const { renderer } = fakeRenderer();
    installPositionalShadowPass(renderer);
    const light = omniLight();
    light.shadow.autoUpdate = false;
    runPass(renderer, [light]);
    renderer.shadowMap.enabled = false;
    runPass(renderer, [omniLight()]);
    expect(copy).not.toHaveBeenCalled();
    copy.mockRestore();
  });

  it('wraps a renderer’s pass once, however often it is installed (error case)', () => {
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => {});
    const { renderer, threePass } = fakeRenderer();
    installPositionalShadowPass(renderer);
    installPositionalShadowPass(renderer);
    runPass(renderer, [omniLight()]);
    expect(threePass).toHaveBeenCalledOnce();
    expect(copy).toHaveBeenCalledOnce();
    copy.mockRestore();
  });
});

/** three's own module source. Its exports map exposes `"./src/*"`. */
function threeSource(path: string): string {
  return readFileSync(createRequire(import.meta.url).resolve(`three/src/${path}`), 'utf8');
}

describe('three’s renderer, as the pass relies on it', () => {
  it('uploads the lights after the shadow pass, so the copy and the lookup matrices land first', () => {
    const renderer = threeSource('renderers/WebGLRenderer.js');
    const pass = renderer.indexOf('shadowMap.render( shadowsArray, scene, camera );');
    expect(pass).toBeGreaterThan(0);
    expect(renderer.indexOf('currentRenderState.setupLights();', pass)).toBeGreaterThan(pass);
  });

  it('builds a map only for a shadow that has none, and renders an omni light into a cube', () => {
    const shadowPass = threeSource('renderers/webgl/WebGLShadowMap.js');
    expect(shadowPass).toContain('if ( shadow.map === null || typeChanged === true ) {');
    expect(shadowPass).toContain(
      'const faceCount = shadow.map.isWebGLCubeRenderTarget ? 6 : shadow.getViewportCount();'
    );
    expect(shadowPass).toContain('renderer.setRenderTarget( shadow.map, face );');
  });

  it('overwrites an omni light’s matrix in its pass, which the copy writes after (edge case)', () => {
    const shadowPass = threeSource('renderers/webgl/WebGLShadowMap.js');
    expect(shadowPass).toContain('shadowMatrix.makeTranslation( - _lightPositionWorld.x');
    expect(shadowPass).toContain('const far = light.distance || camera.far;');
  });

  it('hands each light’s own matrix to the lit programs by reference', () => {
    const lights = threeSource('renderers/webgl/WebGLLights.js');
    expect(lights).toContain('state.pointShadowMatrix[ pointLength ] = light.shadow.matrix;');
    expect(lights).toContain('state.spotLightMatrix[ spotLength ] = shadow.matrix;');
  });
});
