/**
 * The cube background adds Godot's debanding noise after the sky fog, at the pixel position Godot
 * counts from its viewport's top-left corner. The tests read the installed three, so a release
 * that rewrites the replaced line fails here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { debandSky, installSkyDebanding, isDebanded } from './skyDebanding';
import { installFogComposite } from '../fog/fogComposite';
import { decodeSkyMaterial } from '../../resources/sky/decode';
import type { SkyProperties } from '../../resources/sky/types';
import { warningsOf } from '../testing/logWarnings';

const backgroundCube = THREE.ShaderLib.backgroundCube!;
const threeCubeFragment = THREE.ShaderChunk.backgroundCube_frag;
const threeProgramFragment = backgroundCube.fragmentShader;

afterEach(() => {
  THREE.ShaderChunk.backgroundCube_frag = threeCubeFragment;
  backgroundCube.fragmentShader = threeProgramFragment;
  delete backgroundCube.uniforms.godotSkyDebanding;
});

function material(type: string, data: Record<string, string> = {}): SkyProperties {
  return decodeSkyMaterial(type, data)!;
}

describe('isDebanded', () => {
  it('debands a ProceduralSkyMaterial by default, as its constructor sets', () => {
    expect(isDebanded(material('ProceduralSkyMaterial'))).toBe(true);
  });

  it('debands a PhysicalSkyMaterial by default, as its constructor sets', () => {
    expect(isDebanded(material('PhysicalSkyMaterial'))).toBe(true);
  });

  it('does not deband a sky that turns use_debanding off', () => {
    expect(isDebanded(material('ProceduralSkyMaterial', { use_debanding: 'false' }))).toBe(false);
  });

  it('never debands a PanoramaSkyMaterial, which has no such mode (edge case)', () => {
    expect(isDebanded(material('PanoramaSkyMaterial'))).toBe(false);
  });
});

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

    expect(backgroundCube.fragmentShader).toBe(fragment);
    expect(backgroundCube.uniforms.godotSkyDebanding?.value).toBeInstanceOf(Float32Array);
  });

  it('changes nothing on a second call (edge case)', () => {
    const once = installedFragment();
    installSkyDebanding();

    expect(THREE.ShaderChunk.backgroundCube_frag).toBe(once);
  });

  it('keeps three’s fragment and warns when three lacks the tone curve line (error case)', () => {
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

function debandingValue(): Float32Array {
  installedFragment();
  return backgroundCube.uniforms.godotSkyDebanding!.value as Float32Array;
}

const startRender = (scene: THREE.Scene) =>
  (scene.onBeforeRender as (...args: unknown[]) => void)(null, scene, new THREE.Camera(), null);
const endRender = (scene: THREE.Scene) => (scene.onAfterRender as (...args: unknown[]) => void)();

describe('debandSky', () => {
  it("turns the noise on in each render, at the viewport's left and top edges", () => {
    const debanding = debandingValue();
    const scene = new THREE.Scene();
    const stop = debandSky(rendererAt(new THREE.Vector4(0, 0, 955, 756)), scene);

    startRender(scene);
    const inRender = [...debanding];
    endRender(scene);
    stop();

    expect(inRender).toEqual([1, 0, 756]);
  });

  it('counts the rows from the top of a viewport that sits off the origin (edge case)', () => {
    const debanding = debandingValue();
    const scene = new THREE.Scene();
    const stop = debandSky(rendererAt(new THREE.Vector4(10, 20, 100, 50)), scene);

    startRender(scene);
    const inRender = [...debanding];
    endRender(scene);
    stop();

    expect(inRender).toEqual([1, 10, 70]);
  });

  it('turns the noise off when the render ends, so another scene draws none', () => {
    const debanding = debandingValue();
    const scene = new THREE.Scene();
    const stop = debandSky(rendererAt(new THREE.Vector4(0, 0, 4, 4)), scene);

    startRender(scene);
    endRender(scene);
    stop();

    expect(debanding[0]).toBe(0);
  });

  it('leaves the noise off in a render after its disposer runs (error case)', () => {
    const debanding = debandingValue();
    const scene = new THREE.Scene();
    debandSky(rendererAt(new THREE.Vector4(0, 0, 4, 4)), scene)();

    startRender(scene);

    expect(debanding[0]).toBe(0);
  });
});
