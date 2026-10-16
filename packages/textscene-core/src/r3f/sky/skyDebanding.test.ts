/**
 * The cube background adds Godot's debanding noise after the sky fog, at the pixel position Godot
 * counts from its viewport's top-left corner. The tests read the installed three, so a release
 * that rewrites the replaced line fails here.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { debandSky, installSkyDebanding } from './skyDebanding';
import { installFogComposite } from '../fog/fogComposite';
import { backgroundCube } from '../shaderPatch/backgroundPrograms';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';
import { warningsOf } from '../testing/logWarnings';

restoreShaderGlobalsAfterEach();

/** The background fragment as both patches leave it. */
function installedFragment(): string {
  installFogComposite();
  installSkyDebanding();
  return THREE.ShaderChunk.backgroundCube_frag;
}

describe('installSkyDebanding', () => {
  it('adds the noise after the sky fog and before the tone curve', () => {
    const fragment = installedFragment();
    const noise = fragment.indexOf('godotSkyDebanding.x *');

    expect(noise).toBeGreaterThan(fragment.indexOf('godotSkyFog( gl_FragColor.rgb'));
    expect(noise).toBeLessThan(fragment.indexOf('#include <tonemapping_fragment>'));
  });

  it('hands the patched fragment and its uniform to the program three compiles', () => {
    const fragment = installedFragment();

    expect(backgroundCube().fragmentShader).toBe(fragment);
    expect(backgroundCube().uniforms.godotSkyDebanding?.value).toBeInstanceOf(Float32Array);
  });

  it('changes nothing on a second call (edge case)', () => {
    const once = installedFragment();
    installSkyDebanding();

    expect(THREE.ShaderChunk.backgroundCube_frag).toBe(once);
  });

  it("keeps three's fragment and warns when three lacks the tone curve line (error case)", () => {
    THREE.ShaderChunk.backgroundCube_frag = 'godotSkyFog void main() {}';
    const warnings = warningsOf(() => installSkyDebanding());

    expect(THREE.ShaderChunk.backgroundCube_frag).toBe('godotSkyFog void main() {}');
    expect(warnings.join('\n')).toContain('backgroundCube_frag');
  });
});

/** A renderer whose current viewport is `viewport`, all `debandSky` reads of it. */
function rendererAt(viewport: THREE.Vector4): THREE.WebGLRenderer {
  return {
    getCurrentViewport: (target: THREE.Vector4) => target.copy(viewport),
  } as unknown as THREE.WebGLRenderer;
}

describe('debandSky', () => {
  const camera = new THREE.Camera();
  let debanding: Float32Array;
  let scene: THREE.Scene;

  beforeEach(() => {
    installedFragment();
    debanding = backgroundCube().uniforms.godotSkyDebanding!.value as Float32Array;
    scene = new THREE.Scene();
  });

  /** The uniform during one render of the scene, which ends before the call returns. */
  function debandingInRender(): number[] {
    fireSceneRender(scene, camera);
    const inRender = [...debanding];
    fireSceneRenderEnd(scene, camera);
    return inRender;
  }

  it.each([
    ["at the canvas's left and top edges", new THREE.Vector4(0, 0, 955, 756), [1, 0, 756]],
    [
      'at the edges of a viewport off the origin (edge case)',
      new THREE.Vector4(10, 20, 100, 50),
      [1, 10, 70],
    ],
  ])('turns the noise on in each render, %s', (_, viewport, expected) => {
    const stop = debandSky(rendererAt(viewport), scene);

    const inRender = debandingInRender();
    stop();

    expect(inRender).toEqual(expected);
  });

  it('turns the noise off when the render ends, so another scene draws none', () => {
    const stop = debandSky(rendererAt(new THREE.Vector4(0, 0, 4, 4)), scene);

    debandingInRender();
    stop();

    expect(debanding[0]).toBe(0);
  });

  it('leaves the noise off in a render after its disposer runs (error case)', () => {
    debandSky(rendererAt(new THREE.Vector4(0, 0, 4, 4)), scene)();

    expect(debandingInRender()[0]).toBe(0);
  });
});
