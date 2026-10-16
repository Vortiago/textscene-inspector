/**
 * The pass runs inside three's renderer, which happy-dom cannot run, so a stand-in renderer records
 * what the wrapped pass does. The last block reads three's own source, so a release that moves what
 * the pass relies on fails here and not in a golden.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { AtlasOmniShadow } from './positionalShadow/atlasOmniShadow';
import { installedFramebufferHeight } from './shadowFilter/framebufferRows.testkit';
import { OmniShadowCopy } from './positionalShadow/omniShadowCopy';
import { installShadowPass, readShadowMaps } from './shadowPass';
import { holdPositionalShadowAtlas } from './positionalShadow/shadowAtlasTarget';
import { AtlasAreaShadow, type AreaShadowLight } from './positionalShadow/atlasAreaShadow';
import { AtlasDepthMaterial, ParaboloidDepthMaterial } from './positionalShadow/atlasDepthMaterials';
import { AtlasSpotShadow } from './positionalShadow/atlasSpotShadow';
import { SplitSunLight } from './directionalShadow/splitSun';
import {
  installSunShadowUniforms,
  SLOT_MATRIX_ROWS,
  SUN_SHADOW_ROWS,
} from './directionalShadow/sunShadowUniforms';
import { litUniformArray } from './testing/litUniformArray';
import { profiledRendererMembers, profiledWindow, stepCpuMs } from './frameProfile/frameProfile.testkit';

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
    ...profiledRendererMembers(),
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

/** An area light that holds a slot in the atlas, or none. */
function areaLight(hasSlot = true): AreaShadowLight {
  const light = new THREE.RectAreaLight() as AreaShadowLight;
  light.shadow = new AtlasAreaShadow();
  light.shadow.place(hasSlot ? { x: 0, y: 0, size: 512, paraboloidStep: null } : null);
  return light;
}

/** A spot light that holds a slot in the atlas, or none. */
function spotLight(hasSlot = true): THREE.SpotLight {
  const light = new THREE.SpotLight();
  light.shadow = new AtlasSpotShadow();
  (light.shadow as AtlasSpotShadow).place(hasSlot ? { x: 512, y: 0, size: 512, paraboloidStep: null } : null);
  return light;
}

const runPass = (renderer: THREE.WebGLRenderer, lights: THREE.Light[]) =>
  renderer.shadowMap.render(lights, new THREE.Scene(), new THREE.PerspectiveCamera());

describe('installShadowPass', () => {
  it('runs three’s pass, then copies each omni light that holds a slot', () => {
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => {});
    const { renderer, threePass } = fakeRenderer();
    installShadowPass(renderer);
    const [held, unheld] = [omniLight(), omniLight(false)];
    const spot = new THREE.SpotLight();
    runPass(renderer, [held, unheld, spot]);
    expect(threePass).toHaveBeenCalledOnce();
    expect(copy.mock.calls.map(([, light]) => light)).toEqual([held]);
    expect(held.shadow.matrix.elements[11]).toBe(512 / 4096);
    copy.mockRestore();
  });

  it('records the height of the target the draw goes to, after the copies', () => {
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => {});
    const { renderer } = fakeRenderer();
    installShadowPass(renderer);
    runPass(renderer, [omniLight()]);
    expect(installedFramebufferHeight()[0]).toBe(48);
    copy.mockRestore();
  });

  it('copies nothing that three’s pass did not draw (edge case)', () => {
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => {});
    const { renderer } = fakeRenderer();
    installShadowPass(renderer);
    const light = omniLight();
    light.shadow.autoUpdate = false;
    runPass(renderer, [light]);
    renderer.shadowMap.enabled = false;
    runPass(renderer, [omniLight()]);
    expect(copy).not.toHaveBeenCalled();
    copy.mockRestore();
  });

  it('draws each area light that holds a slot with three’s pass again, after the omni copies', () => {
    const order: string[] = [];
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => order.push('copy'));
    const { renderer, threePass } = fakeRenderer();
    threePass.mockImplementation((lights: THREE.Light[]) =>
      order.push(lights.length === 1 ? 'area' : 'three')
    );
    installShadowPass(renderer);
    const [held, unheld] = [areaLight(), areaLight(false)];
    runPass(renderer, [omniLight(), held, unheld]);
    expect(order).toEqual(['three', 'copy', 'area']);
    expect(threePass.mock.calls[1]![0]).toEqual([held]);
    copy.mockRestore();
  });

  it('draws each spot light that holds a slot with three’s pass again, before the area lights', () => {
    const { renderer, threePass } = fakeRenderer();
    installShadowPass(renderer);
    const [held, unheld, area] = [spotLight(), spotLight(false), areaLight()];
    runPass(renderer, [held, unheld, area]);
    expect(threePass.mock.calls.map(([lights]) => lights)).toEqual([[held, unheld, area], [held], [area]]);
  });

  it('draws each split sun with the spot lights in one pass again, before the area lights', () => {
    const { renderer, threePass } = fakeRenderer();
    installShadowPass(renderer);
    const [spot, sun, area] = [spotLight(), new SplitSunLight(), areaLight()];
    runPass(renderer, [sun, spot, area]);
    expect(threePass.mock.calls.map(([lights]) => lights)).toEqual([[sun, spot, area], [sun, spot], [area]]);
    expect(sun.shadow.needsUpdate).toBe(true);
  });

  it('draws a split sun’s casters with the atlas’s depth, which writes the colour (edge case)', () => {
    const { renderer, threePass } = fakeRenderer();
    const scene = new THREE.Scene();
    const caster = new THREE.Mesh();
    caster.castShadow = true;
    scene.add(caster);
    const worn: unknown[] = [];
    threePass.mockImplementation(() => worn.push(caster.customDepthMaterial));
    installShadowPass(renderer);
    renderer.shadowMap.render([new SplitSunLight()], scene, new THREE.PerspectiveCamera());
    expect(worn[1]).toBeInstanceOf(AtlasDepthMaterial);
  });

  it('draws a spot light’s casters with the atlas’s depth, which writes the colour (edge case)', () => {
    const { renderer, threePass } = fakeRenderer();
    const scene = new THREE.Scene();
    const caster = new THREE.Mesh();
    caster.castShadow = true;
    scene.add(caster);
    const worn: unknown[] = [];
    threePass.mockImplementation(() => worn.push(caster.customDepthMaterial));
    installShadowPass(renderer);
    renderer.shadowMap.render([spotLight()], scene, new THREE.PerspectiveCamera());
    expect(worn[0]).toBeUndefined();
    expect(worn[1]).toBeInstanceOf(AtlasDepthMaterial);
    expect(caster.customDepthMaterial).toBeUndefined();
  });

  it('asks three’s pass to draw the area light, which three’s first call left alone', () => {
    const { renderer, threePass } = fakeRenderer();
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    const light = areaLight();
    const asked: boolean[] = [];
    threePass.mockImplementation(() => {
      asked.push(renderer.shadowMap.needsUpdate && light.shadow.needsUpdate);
      renderer.shadowMap.needsUpdate = false;
    });
    installShadowPass(renderer);
    runPass(renderer, [light]);
    expect(asked).toEqual([false, true]);
  });

  it('draws the casters with the paraboloid’s depth, and gives each its own back (edge case)', () => {
    const { renderer, threePass } = fakeRenderer();
    const scene = new THREE.Scene();
    const [caster, ownDepth, plain] = [new THREE.Mesh(), new THREE.MeshDepthMaterial(), new THREE.Mesh()];
    caster.castShadow = plain.castShadow = true;
    caster.customDepthMaterial = ownDepth;
    scene.add(caster, plain);
    const worn: unknown[] = [];
    threePass.mockImplementation(() => worn.push(caster.customDepthMaterial, plain.customDepthMaterial));
    installShadowPass(renderer);
    renderer.shadowMap.render([areaLight()], scene, new THREE.PerspectiveCamera());
    expect(worn.slice(0, 2)).toEqual([ownDepth, undefined]);
    expect(worn.slice(2).map((depth) => depth instanceof ParaboloidDepthMaterial)).toEqual([true, true]);
    expect(caster.customDepthMaterial).toBe(ownDepth);
    expect(plain.customDepthMaterial).toBeUndefined();
  });

  it('draws no area light when three’s pass draws nothing (edge case)', () => {
    const { renderer, threePass } = fakeRenderer();
    renderer.shadowMap.autoUpdate = false;
    installShadowPass(renderer);
    runPass(renderer, [areaLight()]);
    expect(threePass).toHaveBeenCalledOnce();
  });

  it('wraps a renderer’s pass once, however often it is installed (error case)', () => {
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => {});
    const { renderer, threePass } = fakeRenderer();
    installShadowPass(renderer);
    installShadowPass(renderer);
    runPass(renderer, [omniLight()]);
    expect(threePass).toHaveBeenCalledOnce();
    expect(copy).toHaveBeenCalledOnce();
    copy.mockRestore();
  });
});

describe('readShadowMaps', () => {
  it('reads the maps after three’s pass and the omni copies, for the scene and camera rendered', () => {
    const order: string[] = [];
    const copy = vi.spyOn(OmniShadowCopy.prototype, 'copy').mockImplementation(() => order.push('copy'));
    const { renderer, threePass } = fakeRenderer();
    threePass.mockImplementation(() => order.push('three'));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const reader = vi.fn(() => order.push('read'));
    readShadowMaps(renderer, reader);

    renderer.shadowMap.render([omniLight()], scene, camera);

    expect(order).toEqual(['three', 'copy', 'read']);
    expect(reader).toHaveBeenCalledWith(scene, camera);
    copy.mockRestore();
  });

  it('records the height of the draw’s target after a reader renders into another (edge case)', () => {
    const { renderer } = fakeRenderer();
    readShadowMaps(renderer, () => {
      installedFramebufferHeight()[0] = 1;
    });

    runPass(renderer, []);

    expect(installedFramebufferHeight()[0]).toBe(48);
  });

  it('calls a reader that a module evaluated again adds to a pass already wrapped (edge case)', async () => {
    const { renderer } = fakeRenderer();
    installShadowPass(renderer);
    vi.resetModules();
    const reloaded = await import('./shadowPass');
    const reader = vi.fn();
    reloaded.readShadowMaps(renderer, reader);

    runPass(renderer, []);

    expect(reader).toHaveBeenCalledOnce();
  });

  it('stops calling a reader once its disposer runs (error case)', () => {
    const { renderer } = fakeRenderer();
    const reader = vi.fn();
    const stop = readShadowMaps(renderer, reader);
    stop();

    runPass(renderer, []);

    expect(reader).not.toHaveBeenCalled();
  });
});

/** three's own module source. Its exports map exposes `"./src/*"`. */
function threeSource(path: string): string {
  return readFileSync(createRequire(import.meta.url).resolve(`three/src/${path}`), 'utf8');
}

describe('the shadow pass under a frame profile', () => {
  it('times three’s pass as the Shadows step and the readers as the Fog step', () => {
    let time = 0;
    const { renderer, threePass } = fakeRenderer();
    threePass.mockImplementation(() => (time += 3));
    readShadowMaps(renderer, () => (time += 2));

    const stats = profiledWindow(
      renderer,
      () => time,
      () => runPass(renderer, [new THREE.DirectionalLight()])
    );

    expect(stepCpuMs(stats)).toEqual([
      ['Shadows', 3],
      ['Fog', 2],
      ['Other', 0],
    ]);
  });

  it('times a render a reader makes as part of the Fog step, not as another run', () => {
    let time = 0;
    const { renderer, threePass } = fakeRenderer();
    threePass.mockImplementation(() => (time += 3));
    const fogged = new THREE.Scene();
    readShadowMaps(renderer, (rendered) => {
      if (rendered !== fogged) return;
      time += 2;
      runPass(renderer, [new THREE.DirectionalLight()]);
    });
    const camera = new THREE.PerspectiveCamera();

    const stats = profiledWindow(
      renderer,
      () => time,
      () => renderer.shadowMap.render([new THREE.DirectionalLight()], fogged, camera)
    );

    expect(stats.steps.map((s) => [s.step, s.cpuMs, s.runsPerFrame])).toEqual([
      ['Shadows', 3, 1],
      ['Fog', 5, 1],
      ['Other', 0, 1],
    ]);
  });

  it('times no Shadows step for a render with no light, such as a fog pass (edge case)', () => {
    const { renderer } = fakeRenderer();
    installShadowPass(renderer);

    const stats = profiledWindow(
      renderer,
      () => 0,
      () => runPass(renderer, [])
    );

    expect(stepCpuMs(stats)).toEqual([['Other', 0]]);
  });
});

describe('the sun shadow rows', () => {
  /** A split sun whose first slot matrix moves by `x`. */
  function sunAt(x: number): SplitSunLight {
    const sun = new SplitSunLight();
    sun.shadow.getMatrix(0).makeTranslation(x, 0, 0);
    return sun;
  }

  const firstSlotRows = () => {
    installSunShadowUniforms();
    return [...litUniformArray(SUN_SHADOW_ROWS).subarray(0, SLOT_MATRIX_ROWS * 4)];
  };

  it('holds each split sun’s slot matrices after the pass', () => {
    const { renderer } = fakeRenderer();
    installShadowPass(renderer);
    runPass(renderer, [sunAt(3)]);
    expect(firstSlotRows()).toEqual([1, 0, 0, 3, 0, 1, 0, 0, 0, 0, 1, 0]);
  });

  it('holds the rendered scene’s suns after a reader renders another scene (edge case)', () => {
    const { renderer } = fakeRenderer();
    const readerSun = sunAt(7);
    let isReading = false;
    readShadowMaps(renderer, () => {
      if (isReading) return;
      isReading = true;
      runPass(renderer, [readerSun]);
    });
    runPass(renderer, [sunAt(3)]);
    expect(firstSlotRows()[3]).toBe(3);
  });
});

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
