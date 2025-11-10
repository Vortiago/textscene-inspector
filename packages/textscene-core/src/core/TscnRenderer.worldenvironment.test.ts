/**
 * TscnRenderer WorldEnvironment integration tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { TscnRenderer } from './TscnRenderer';
import type { TscnScene } from '../parser/types';
import * as logger from '../logger';

// Mock setupThreeJsScene
vi.mock('./SceneSetup', () => ({
  setupThreeJsScene: vi.fn(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(10, 10, 10);

    const renderer = {
      render: vi.fn(),
      setSize: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement('canvas'),
    };

    const controls = {
      target: new THREE.Vector3(0, 0, 0),
      update: vi.fn(),
      reset: vi.fn(),
    };

    return { scene, camera, renderer, controls };
  }),
}));

describe('TscnRenderer - WorldEnvironment Integration', () => {
  let renderer: TscnRenderer;
  let canvas: HTMLCanvasElement;
  let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    renderer = new TscnRenderer(canvas);
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
    loggerWarnSpy.mockRestore();
    renderer.dispose();
  });

  it('should apply background color from WorldEnvironment', async () => {
    const scene: TscnScene = {
      nodes: [
        {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
          properties: { environment: 'SubResource("Environment_1")' },
          children: [],
        },
      ],
      externalResources: [],
      internalResources: [
        {
          id: 'Environment_1',
          type: 'Environment',
          data: {
            id: 'Environment_1',
            background_mode: '1', // BG_COLOR
            background_color: 'Color(0.15, 0.12, 0.1, 1)',
            background_energy_multiplier: '1.0',
            volumetric_fog_enabled: 'false',
            volumetric_fog_density: '0.05',
            volumetric_fog_albedo: 'Color(1, 1, 1, 1)',
            volumetric_fog_emission: 'Color(0, 0, 0, 1)',
            adjustment_enabled: 'false',
            adjustment_brightness: '1.0',
            adjustment_contrast: '1.0',
            adjustment_saturation: '1.0',
            ssr_enabled: 'false',
          },
        },
      ],
    };

    await renderer.render(scene);

    // Check that background color was applied
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Applied background color')
    );
  });

  it('should apply volumetric fog from WorldEnvironment', async () => {
    const scene: TscnScene = {
      nodes: [
        {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
          properties: { environment: 'SubResource("Environment_1")' },
          children: [],
        },
      ],
      externalResources: [],
      internalResources: [
        {
          id: 'Environment_1',
          type: 'Environment',
          data: {
            id: 'Environment_1',
            background_mode: '0', // BG_CLEAR_COLOR
            background_color: 'Color(0, 0, 0, 1)',
            background_energy_multiplier: '1.0',
            volumetric_fog_enabled: 'true',
            volumetric_fog_density: '0.05',
            volumetric_fog_albedo: 'Color(0.6, 0.7, 0.9, 1)',
            volumetric_fog_emission: 'Color(0, 0, 0, 1)',
            adjustment_enabled: 'false',
            adjustment_brightness: '1.0',
            adjustment_contrast: '1.0',
            adjustment_saturation: '1.0',
            ssr_enabled: 'false',
          },
        },
      ],
    };

    await renderer.render(scene);

    // Check that fog was applied
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Applied volumetric fog')
    );

    // CRITICAL: Verify scene.fog is actually set on the THREE.js scene
    const threeScene = renderer.getSceneForTesting();
    expect(threeScene.fog).toBeDefined();
    expect(threeScene.fog).toBeInstanceOf(THREE.FogExp2);
    if (threeScene.fog && 'density' in threeScene.fog) {
      expect(threeScene.fog.density).toBe(0.05);
      // Check fog color is approximately correct (blue-ish)
      const fogColor = threeScene.fog.color;
      expect(fogColor.r).toBeCloseTo(0.6, 2);
      expect(fogColor.g).toBeCloseTo(0.7, 2);
      expect(fogColor.b).toBeCloseTo(0.9, 2);
    }
  });

  it('should warn about unsupported color adjustments', async () => {
    const scene: TscnScene = {
      nodes: [
        {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
          properties: { environment: 'SubResource("Environment_1")' },
          children: [],
        },
      ],
      externalResources: [],
      internalResources: [
        {
          id: 'Environment_1',
          type: 'Environment',
          data: {
            id: 'Environment_1',
            background_mode: '0',
            background_color: 'Color(0, 0, 0, 1)',
            background_energy_multiplier: '1.0',
            volumetric_fog_enabled: 'false',
            volumetric_fog_density: '0.05',
            volumetric_fog_albedo: 'Color(1, 1, 1, 1)',
            volumetric_fog_emission: 'Color(0, 0, 0, 1)',
            adjustment_enabled: 'true', // ENABLED
            adjustment_brightness: '1.05',
            adjustment_contrast: '1.1',
            adjustment_saturation: '1.2',
            ssr_enabled: 'false',
          },
        },
      ],
    };

    await renderer.render(scene);

    // Check that warning was logged
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Color adjustments')
    );
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('WI-77')
    );
  });

  it('should warn about unsupported SSR', async () => {
    const scene: TscnScene = {
      nodes: [
        {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
          properties: { environment: 'SubResource("Environment_1")' },
          children: [],
        },
      ],
      externalResources: [],
      internalResources: [
        {
          id: 'Environment_1',
          type: 'Environment',
          data: {
            id: 'Environment_1',
            background_mode: '0',
            background_color: 'Color(0, 0, 0, 1)',
            background_energy_multiplier: '1.0',
            volumetric_fog_enabled: 'false',
            volumetric_fog_density: '0.05',
            volumetric_fog_albedo: 'Color(1, 1, 1, 1)',
            volumetric_fog_emission: 'Color(0, 0, 0, 1)',
            adjustment_enabled: 'false',
            adjustment_brightness: '1.0',
            adjustment_contrast: '1.0',
            adjustment_saturation: '1.0',
            ssr_enabled: 'true', // ENABLED
          },
        },
      ],
    };

    await renderer.render(scene);

    // Check that warning was logged
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Screen-space reflections')
    );
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('WI-77')
    );
  });

  it('should warn about unsupported background modes', async () => {
    const scene: TscnScene = {
      nodes: [
        {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
          properties: { environment: 'SubResource("Environment_1")' },
          children: [],
        },
      ],
      externalResources: [],
      internalResources: [
        {
          id: 'Environment_1',
          type: 'Environment',
          data: {
            id: 'Environment_1',
            background_mode: '2', // BG_SKY (unsupported)
            background_color: 'Color(0, 0, 0, 1)',
            background_energy_multiplier: '1.0',
            volumetric_fog_enabled: 'false',
            volumetric_fog_density: '0.05',
            volumetric_fog_albedo: 'Color(1, 1, 1, 1)',
            volumetric_fog_emission: 'Color(0, 0, 0, 1)',
            adjustment_enabled: 'false',
            adjustment_brightness: '1.0',
            adjustment_contrast: '1.0',
            adjustment_saturation: '1.0',
            ssr_enabled: 'false',
          },
        },
      ],
    };

    await renderer.render(scene);

    // Check that warning was logged
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Background mode 2 not yet supported')
    );
  });

  it('should handle scene without WorldEnvironment gracefully', async () => {
    const scene: TscnScene = {
      nodes: [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children: [],
        },
      ],
      externalResources: [],
      internalResources: [],
    };

    await renderer.render(scene);

    // Should not throw and should not log warnings
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  it('should log info about fog emission when non-zero', async () => {
    const scene: TscnScene = {
      nodes: [
        {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
          properties: { environment: 'SubResource("Environment_1")' },
          children: [],
        },
      ],
      externalResources: [],
      internalResources: [
        {
          id: 'Environment_1',
          type: 'Environment',
          data: {
            id: 'Environment_1',
            background_mode: '0',
            background_color: 'Color(0, 0, 0, 1)',
            background_energy_multiplier: '1.0',
            volumetric_fog_enabled: 'true',
            volumetric_fog_density: '0.01',
            volumetric_fog_albedo: 'Color(1, 1, 1, 1)',
            volumetric_fog_emission: 'Color(0.5, 0.3, 0.1, 1)', // NON-ZERO
            adjustment_enabled: 'false',
            adjustment_brightness: '1.0',
            adjustment_contrast: '1.0',
            adjustment_saturation: '1.0',
            ssr_enabled: 'false',
          },
        },
      ],
    };

    await renderer.render(scene);

    // Check that info was logged about emission
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fog emission color detected')
    );
  });
});
