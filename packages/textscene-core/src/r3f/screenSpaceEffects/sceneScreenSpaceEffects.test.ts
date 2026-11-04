import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { OpaqueSentinel } from '../opaqueSentinel';
import { SSAO_PROJECT_DEFAULTS } from '../../godot/rendering/environment/screenSpaceAmbientOcclusion';
import { SceneScreenSpaceEffects, type ScreenSpaceSettings } from './sceneScreenSpaceEffects';
import { SCREEN_SPACE_STATE, screenSpaceState } from './screenSpaceState';
import { occlusionFold } from '../screenSpaceAmbientOcclusion/ssaoUniforms';

const SSAO = {
  radius: 1,
  intensity: 2,
  power: 1.5,
  detail: 0.5,
  horizon: 0.06,
  sharpness: 0.98,
  lightAffect: 0.25,
  aoChannelAffect: 0.5,
};

const SETTINGS: ScreenSpaceSettings = {
  ssr: { maxSteps: 64, fadeIn: 0.15, fadeOut: 2, depthTolerance: 0.2 },
  isHalfSizeReflection: true,
  ssao: null,
  ssaoProject: SSAO_PROJECT_DEFAULTS,
  drawsDepthPrepass: true,
};

/** A render of one world buffer at `settings`, begun but not yet at its opaque list. */
function begunRender(settings: ScreenSpaceSettings) {
  const target = new THREE.WebGLRenderTarget(4, 4);
  const renderer = {} as unknown as THREE.WebGLRenderer;
  const effects = new SceneScreenSpaceEffects(
    renderer,
    () => settings,
    () => {}
  );
  const camera = new THREE.PerspectiveCamera();
  effects.begin(camera, target);
  return { renderer, effects, camera };
}

function reach(sentinel: OpaqueSentinel, renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
  const { mesh } = sentinel;
  mesh.onBeforeRender(renderer, new THREE.Scene(), camera, mesh.geometry, mesh.material, null!);
}

afterEach(() => {
  screenSpaceState.fill(0);
  occlusionFold.fill(0);
});

describe('SceneScreenSpaceEffects', () => {
  it("shows no effect after the opaque list, as Godot's alpha pass reads none", () => {
    const { renderer, effects, camera } = begunRender(SETTINGS);
    screenSpaceState[SCREEN_SPACE_STATE.showsReflection] = 1;
    screenSpaceState[SCREEN_SPACE_STATE.showsOcclusion] = 1;

    reach(effects.lastSentinel, renderer, camera);

    expect(screenSpaceState[SCREEN_SPACE_STATE.showsReflection]).toBe(0);
    expect(screenSpaceState[SCREEN_SPACE_STATE.showsOcclusion]).toBe(0);
  });

  it('draws its last sentinel after every other surface of the opaque list', () => {
    const { effects } = begunRender(SETTINGS);

    expect(effects.lastSentinel.renderOrder).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("folds Godot's black default in, drawing nothing, where the project turns the depth prepass off", () => {
    // `render_forward_clustered.cpp:2081-2086`, `:3529-3530`.
    const settings = { ...SETTINGS, ssr: null, ssao: SSAO, drawsDepthPrepass: false };
    const { renderer, effects, camera } = begunRender(settings);

    reach(effects.firstSentinel, renderer, camera);

    expect(screenSpaceState[SCREEN_SPACE_STATE.showsOcclusion]).toBe(1);
    expect(Array.from(occlusionFold)).toEqual([0.25, 0.5, 0]);
  });
});
