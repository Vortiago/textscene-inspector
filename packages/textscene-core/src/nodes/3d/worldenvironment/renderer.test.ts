/**
 * WorldEnvironment renderer tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { createWorldEnvironment, getEnvironmentSettings } from './renderer';
import type { WorldEnvironmentProperties } from './types';
import type { TscnScene } from '../../../parser/types';
import { BackgroundMode } from '../../../resources/environment/types';
import * as logger from '../../../logger';

describe('WorldEnvironment Renderer', () => {
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  describe('createWorldEnvironment', () => {
    it('should create a THREE.Group with correct name', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("Environment_1")',
      };

      const group = createWorldEnvironment('WorldEnvironment', properties);

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe('WorldEnvironment');
    });

    it('should store nodeType in userData', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("Environment_1")',
      };

      const group = createWorldEnvironment('WorldEnvironment', properties);

      expect(group.userData.nodeType).toBe('WorldEnvironment');
    });

    it('should store properties in userData', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("Environment_1")',
        camera_attributes: 'SubResource("CameraAttributes_1")',
      };

      const group = createWorldEnvironment('WorldEnvironment', properties);

      expect(group.userData.properties).toEqual(properties);
    });

    it('should resolve Environment SubResource and store settings', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("Environment_1")',
      };

      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 'Environment_1',
            type: 'Environment',
            data: {
              id: 'Environment_1',
              background_mode: '1',
              background_color: 'Color(0.15, 0.12, 0.1, 1)',
              background_energy_multiplier: '1.0',
              volumetric_fog_enabled: 'true',
              volumetric_fog_density: '0.001',
              volumetric_fog_albedo: 'Color(0.8, 0.8, 0.9, 1)',
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

      const group = createWorldEnvironment('WorldEnvironment', properties, scene);

      expect(group.userData.environmentSettings).toBeDefined();
      const settings = group.userData.environmentSettings;
      expect(settings.background.mode).toBe(BackgroundMode.BG_COLOR);
      expect(settings.background.color).toEqual({ r: 0.15, g: 0.12, b: 0.1, a: 1 });
      expect(settings.fog).not.toBeNull();
      expect(settings.fog?.enabled).toBe(true);
      expect(settings.fog?.density).toBe(0.001);
    });

    it('should handle missing Environment SubResource gracefully', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("Environment_NotFound")',
      };

      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const group = createWorldEnvironment('WorldEnvironment', properties, scene);

      expect(group.userData.environmentSettings).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment SubResource "Environment_NotFound" not found')
      );
    });

    it('should handle invalid environment reference format', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'InvalidReference',
      };

      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const group = createWorldEnvironment('WorldEnvironment', properties, scene);

      expect(group.userData.environmentSettings).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid environment reference')
      );
    });

    it('should handle missing scene parameter', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("Environment_1")',
      };

      const group = createWorldEnvironment('WorldEnvironment', properties);

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.userData.environmentSettings).toBeUndefined();
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn if Environment reference points to wrong resource type', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("NotAnEnvironment")',
      };

      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 'NotAnEnvironment',
            type: 'StandardMaterial3D',
            data: {
              id: 'NotAnEnvironment',
            },
          },
        ],
      };

      const group = createWorldEnvironment('WorldEnvironment', properties, scene);

      expect(group.userData.environmentSettings).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Expected Environment SubResource, got "StandardMaterial3D"')
      );
    });
  });

  describe('getEnvironmentSettings', () => {
    it('should return environmentSettings from userData', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("Environment_1")',
      };

      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 'Environment_1',
            type: 'Environment',
            data: {
              id: 'Environment_1',
              background_mode: '1',
              background_color: 'Color(0.2, 0.3, 0.4, 1)',
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

      const group = createWorldEnvironment('WorldEnvironment', properties, scene);
      const settings = getEnvironmentSettings(group);

      expect(settings).not.toBeNull();
      expect(settings?.background.color).toEqual({ r: 0.2, g: 0.3, b: 0.4, a: 1 });
    });

    it('should return null if no environmentSettings in userData', () => {
      const properties: WorldEnvironmentProperties = {
        name: 'WorldEnvironment',
        environment: 'SubResource("Environment_1")',
      };

      const group = createWorldEnvironment('WorldEnvironment', properties);
      const settings = getEnvironmentSettings(group);

      expect(settings).toBeNull();
    });
  });
});
