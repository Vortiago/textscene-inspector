/**
 * Pure functions for material processing.
 * Extracted from MaterialLoader for use with createResourceProcessor.
 */

import * as THREE from 'three';
import { warn } from '../../logger';

/** Function type for loading a texture by its resolved res:// path */
export type TextureLoaderFn = (path: string) => Promise<THREE.Texture | null>;

/**
 * Check if a path is a material file (.tres).
 */
export function isMaterialPath(path: string): boolean {
  return path.endsWith('.tres');
}

/**
 * Create a THREE.Material from .tres file content.
 * @param content - The .tres file content
 * @param loadTexture - Function to load textures by resolved res:// path (optional for materials without textures)
 */
export async function createMaterialFromContent(
  content: string,
  loadTexture?: TextureLoaderFn
): Promise<THREE.Material> {
  const { parseTresFile } = await import('../../parser/tresParser');
  const { resolveExtResourcePath } = await import('../SubResourceResolver');

  // parseTresFile throws when [gd_resource] header is absent or typeless.
  const { resourceType, properties, extResources } = parseTresFile(content);

  // A header-only .tres (no [resource] section) is valid enough to warn on
  // rather than throw; yield a default StandardMaterial3D.
  const hasResourceSection = /^\[resource\b/m.test(content);
  if (!hasResourceSection) {
    warn(
      `[material] .tres has no [resource] section (type="${resourceType}") — using default StandardMaterial3D.`
    );
    return new THREE.MeshStandardMaterial();
  }

  switch (resourceType) {
    case 'StandardMaterial3D': {
      const { parseColor } = await import('../materials/standardmaterial3d/parser');
      const { createStandardMaterial } = await import('../materials/standardmaterial3d/renderer');
      const { parseVector3 } = await import('../../parser/vectors');

      // Build StandardMaterial3DProperties from raw string properties.
      // parseTresFile returns Record<string, string> — all values are raw strings.
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(properties)) {
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
      }

      // Load textures in parallel if loader provided.
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
            const texPath = resolveExtResourcePath(propValue, extResources);
            if (texPath) {
              texturePromises.push(
                loadTexture(texPath).then((texture) => ({ slot, texture }))
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
      // ADR-0004: we don't compile GLSL. Approximate a ShaderMaterial as a
      // translucent, slightly-emissive standard material so the lenient render
      // path keeps going instead of throwing (e.g. ld-58's window-glass shader).
      warn(
        '[material] ShaderMaterial is not compiled — rendering a translucent ' +
          'standard-material fallback.'
      );
      return new THREE.MeshStandardMaterial({
        color: 0xaaccdd,
        transparent: true,
        opacity: 0.5,
        metalness: 0.2,
        roughness: 0.1,
        emissive: 0x223344,
        emissiveIntensity: 0.3,
      });

    default:
      throw new Error(`Unsupported material type: ${resourceType}`);
  }
}
