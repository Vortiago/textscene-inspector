/**
 * Pure functions for material processing.
 * Extracted from MaterialLoader for use with createResourceProcessor.
 */

import * as THREE from 'three';

/** Function type for loading textures by ID */
export type TextureLoaderFn = (id: string) => Promise<THREE.Texture | null>;

/**
 * Check if a path is a material file (.tres).
 */
export function isMaterialPath(path: string): boolean {
  return path.endsWith('.tres');
}

/**
 * Parse ExtResource("id") reference and return the path.
 * Returns null if not a valid ExtResource reference.
 */
export function parseReference(value: string): string | null {
  const match = value.match(/ExtResource\("([^"]+)"\)/);
  return match?.[1] ?? null;
}

/**
 * Create a THREE.Material from .tres file content.
 * @param content - The .tres file content
 * @param loadTexture - Function to load textures by ID (optional for materials without textures)
 */
export async function createMaterialFromContent(
  content: string,
  loadTexture?: TextureLoaderFn
): Promise<THREE.Material> {
  // Parse .tres file
  const { parseResourceFile } = await import('../../parser/resourceParsers');
  const { type, properties } = parseResourceFile(content);

  // Parse and create material based on type
  switch (type) {
    case 'StandardMaterial3D': {
      const { parseColor } = await import('../materials/standardmaterial3d/parser');
      const { createStandardMaterial } = await import('../materials/standardmaterial3d/renderer');
      const { parseVector3 } = await import('../../parser/vectors');
      const { warn } = await import('../../logger');

      // Build StandardMaterial3DProperties from parsed properties
      const result: Record<string, unknown> = {};

      // Convert parsed properties
      for (const [key, value] of Object.entries(properties)) {
        if (value && typeof value === 'object' && 'type' in value) {
          const typedValue = value as {
            type: string;
            r?: number;
            g?: number;
            b?: number;
            a?: number;
            x?: number;
            y?: number;
            z?: number;
          };
          if (
            typedValue.type === 'Color' &&
            'r' in typedValue &&
            'g' in typedValue &&
            'b' in typedValue &&
            'a' in typedValue
          ) {
            // Store parsed color directly
            result[key] = {
              r: typedValue.r,
              g: typedValue.g,
              b: typedValue.b,
              a: typedValue.a,
            };
          } else if (
            typedValue.type === 'Vector3' &&
            'x' in typedValue &&
            'y' in typedValue &&
            'z' in typedValue
          ) {
            result[key] = { x: typedValue.x, y: typedValue.y, z: typedValue.z };
          }
        } else if (typeof value === 'string') {
          // Parse string values
          if (value.startsWith('Color(')) {
            try {
              result[key] = parseColor(value);
            } catch (error) {
              warn(`Failed to parse ${key}: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else if (value.startsWith('Vector3(')) {
            try {
              result[key] = parseVector3(value);
            } catch (error) {
              warn(`Failed to parse ${key}: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else if (value === 'true') {
            result[key] = true;
          } else if (value === 'false') {
            result[key] = false;
          } else {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              result[key] = num;
            }
          }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          result[key] = value;
        }
      }

      // Load textures in parallel if loader provided
      if (loadTexture) {
        const textureSlots = [
          'albedo_texture',
          'normal_texture',
          'metallic_texture',
          'roughness_texture',
          'ao_texture',
          'emission_texture',
        ];

        const texturePromises: Promise<{ slot: string; texture: THREE.Texture | null }>[] = [];

        for (const slot of textureSlots) {
          const propValue = properties[slot];
          if (typeof propValue === 'string') {
            const texRef = parseReference(propValue);
            if (texRef) {
              texturePromises.push(
                loadTexture(texRef).then((texture) => ({ slot, texture }))
              );
            }
          }
        }

        if (texturePromises.length > 0) {
          const loadedTextures = await Promise.all(texturePromises);
          for (const { slot, texture } of loadedTextures) {
            if (texture) {
              result[slot] = texture;
            }
          }
        }
      }

      return createStandardMaterial(result);
    }

    case 'ShaderMaterial':
      throw new Error('ShaderMaterial not yet supported');

    default:
      throw new Error(`Unsupported material type: ${type}`);
  }
}
