/**
 * StandardMaterial3D parser - parses StandardMaterial3D resources from TSCN.
 */

import type { Color, StandardMaterial3DProperties } from './types';
import { ResourceRegistry } from '../../ResourceRegistry';
import { warn } from '../../../logger';
import { parseVector3 } from '../../../parser/vectors';

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

  if (properties.uv1_scale) {
    try {
      result.uv1_scale = parseVector3(properties.uv1_scale);
    } catch (error) {
      warn(
        `Failed to parse uv1_scale: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Load external texture references in PARALLEL if registry provided
  // This significantly improves performance (e.g., 6 textures in ~50ms vs ~300ms sequential)
  if (registry) {
    type TextureSlot =
      | 'albedo_texture'
      | 'normal_texture'
      | 'metallic_texture'
      | 'roughness_texture'
      | 'ao_texture'
      | 'emission_texture';

    // Collect all texture references to load
    const textureSlots: { slot: TextureSlot; ref: string }[] = [];

    const slotMappings: { property: string; slot: TextureSlot }[] = [
      { property: 'albedo_texture', slot: 'albedo_texture' },
      { property: 'normal_texture', slot: 'normal_texture' },
      { property: 'metallic_texture', slot: 'metallic_texture' },
      { property: 'roughness_texture', slot: 'roughness_texture' },
      { property: 'ao_texture', slot: 'ao_texture' },
      { property: 'emission_texture', slot: 'emission_texture' },
    ];

    for (const { property, slot } of slotMappings) {
      if (properties[property]) {
        const texRef = ResourceRegistry.parseReference(properties[property]);
        if (texRef) {
          textureSlots.push({ slot, ref: texRef });
        }
      }
    }

    // Load all textures in parallel
    if (textureSlots.length > 0) {
      const loadPromises = textureSlots.map(async ({ slot, ref }) => {
        const texture = await registry.loadTexture(ref);
        return { slot, texture };
      });

      const loadedTextures = await Promise.all(loadPromises);

      // Apply loaded textures to result
      for (const { slot, texture } of loadedTextures) {
        if (texture) {
          result[slot] = texture;
        }
      }
    }
  }

  return result;
}
