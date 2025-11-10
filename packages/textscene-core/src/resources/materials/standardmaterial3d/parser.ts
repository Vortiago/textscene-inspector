/**
 * StandardMaterial3D parser - parses StandardMaterial3D resources from TSCN.
 */

import type { Color, StandardMaterial3DProperties } from './types';
import { ResourceRegistry } from '../../ResourceRegistry';
import { warn } from '../../../logger';

/**
 * Parse Color from Godot format: Color(r, g, b, a)
 * Values are in range 0-1
 */
export function parseColor(value: string): Color {
  const match = value.match(/^Color\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);

  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) {
    throw new Error(`Invalid Color format: ${value}`);
  }

  return {
    r: parseFloat(match[1]),
    g: parseFloat(match[2]),
    b: parseFloat(match[3]),
    a: parseFloat(match[4]),
  };
}

/**
 * Parse StandardMaterial3D properties from TSCN sub_resource data.
 * Now async to support loading external textures via ResourceRegistry.
 */
export async function parseStandardMaterial3D(
  properties: Record<string, string>,
  registry?: ResourceRegistry
): Promise<StandardMaterial3DProperties> {
  const result: StandardMaterial3DProperties = {};

  if (properties.albedo_color) {
    try {
      result.albedo_color = parseColor(properties.albedo_color);
    } catch (error) {
      warn(
        `Failed to parse albedo_color: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (properties.metallic !== undefined) {
    const metallic = parseFloat(properties.metallic);
    if (!isNaN(metallic)) {
      result.metallic = metallic;
    }
  }

  if (properties.roughness !== undefined) {
    const roughness = parseFloat(properties.roughness);
    if (!isNaN(roughness)) {
      result.roughness = roughness;
    }
  }

  if (properties.transparency !== undefined) {
    const transparency = parseFloat(properties.transparency);
    if (!isNaN(transparency)) {
      result.transparency = transparency;
    }
  }

  if (properties.normal_enabled !== undefined) {
    result.normal_enabled = properties.normal_enabled === 'true';
  }

  if (properties.emission_enabled !== undefined) {
    result.emission_enabled = properties.emission_enabled === 'true';
  }

  // Load external texture references if registry provided
  if (registry) {
    // Albedo texture
    if (properties.albedo_texture) {
      const albedoTexRef = ResourceRegistry.parseReference(properties.albedo_texture);
      if (albedoTexRef) {
        const texture = await registry.loadTexture(albedoTexRef);
        if (texture) {
          result.albedo_texture = texture;
        }
      }
    }

    // Normal texture
    if (properties.normal_texture) {
      const normalTexRef = ResourceRegistry.parseReference(properties.normal_texture);
      if (normalTexRef) {
        const texture = await registry.loadTexture(normalTexRef);
        if (texture) {
          result.normal_texture = texture;
        }
      }
    }

    // Metallic texture
    if (properties.metallic_texture) {
      const metallicTexRef = ResourceRegistry.parseReference(properties.metallic_texture);
      if (metallicTexRef) {
        const texture = await registry.loadTexture(metallicTexRef);
        if (texture) {
          result.metallic_texture = texture;
        }
      }
    }

    // Roughness texture
    if (properties.roughness_texture) {
      const roughnessTexRef = ResourceRegistry.parseReference(properties.roughness_texture);
      if (roughnessTexRef) {
        const texture = await registry.loadTexture(roughnessTexRef);
        if (texture) {
          result.roughness_texture = texture;
        }
      }
    }

    // AO texture
    if (properties.ao_texture) {
      const aoTexRef = ResourceRegistry.parseReference(properties.ao_texture);
      if (aoTexRef) {
        const texture = await registry.loadTexture(aoTexRef);
        if (texture) {
          result.ao_texture = texture;
        }
      }
    }

    // Emission texture
    if (properties.emission_texture) {
      const emissionTexRef = ResourceRegistry.parseReference(properties.emission_texture);
      if (emissionTexRef) {
        const texture = await registry.loadTexture(emissionTexRef);
        if (texture) {
          result.emission_texture = texture;
        }
      }
    }
  }

  return result;
}
