/**
 * Pure functions for material processing.
 * Extracted from MaterialLoader for use with createResourceProcessor.
 */

import * as THREE from 'three';
import { warn } from '../../logger';
import { BUILDABLE_MATERIAL_TYPES } from '../materials/buildableMaterialTypes';

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
 *
 * @param content - The .tres file content
 * @param loadTexture - Function to load textures by resolved res:// path (optional for materials without textures)
 * @param subResourceId - Build the `[sub_resource id="…"]` with this id instead
 *   of the file's own `[resource]` body — the material a mesh's `.tres` carries
 *   for one of its surfaces. The type switch then follows the SUB-RESOURCE's
 *   type (the file's is whatever owns it, e.g. `ArrayMesh`), while texture
 *   `ExtResource`s still resolve against the owning file's table, which is the
 *   only scope those ids are declared in.
 */
export async function createMaterialFromContent(
  content: string,
  loadTexture?: TextureLoaderFn,
  subResourceId?: string
): Promise<THREE.Material> {
  const { parseTresFile } = await import('../../parser/parsedResource');
  const { resolveExtResourcePath, findSubResource } = await import('../SubResourceResolver');

  // parseTresFile throws when [gd_resource] header is absent or typeless.
  const parsed = parseTresFile(content);
  const { extResources } = parsed;

  let resourceType: string;
  let properties: Record<string, string>;

  if (subResourceId !== undefined) {
    const sub = findSubResource(parsed.subResources, subResourceId);
    if (!sub) {
      // An address naming a sub-resource the file does not declare is as
      // unresolvable as a missing file, and reaches the consumer the same way:
      // cached as a failure, so the slot renders its neutral default.
      throw new Error(
        `Sub-resource "${subResourceId}" is not declared in this ${parsed.resourceType} .tres`
      );
    }
    resourceType = sub.type;
    properties = sub.data as Record<string, string>;
  } else {
    resourceType = parsed.resourceType;
    properties = parsed.properties;

    // A header-only .tres (no [resource] section) is valid enough to warn on
    // rather than throw; yield a default StandardMaterial3D. Leading whitespace
    // is tolerated because the scanning loop trims heading lines.
    if (!/^[ \t]*\[resource\b/m.test(content)) {
      warn(
        `[material] .tres has no [resource] section (type="${resourceType}") — using default StandardMaterial3D.`
      );
      return new THREE.MeshStandardMaterial();
    }
  }

  // Gate on the shared set rather than only on the switch's `default`, so a case
  // added here without adding its type there fails loudly instead of becoming a
  // type producers still refuse to address.
  if (!BUILDABLE_MATERIAL_TYPES.has(resourceType)) {
    throw new Error(`Unsupported material type: ${resourceType}`);
  }

  switch (resourceType) {
    case 'StandardMaterial3D': {
      const { parseColor } = await import('../materials/standardmaterial3d/parser');
      const { createStandardMaterial } = await import('../materials/standardmaterial3d/renderer');
      const { parseVector3 } = await import('../../parser/vectors');

      // Build StandardMaterial3DProperties by decoding the raw value strings.
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
          if (propValue !== undefined) {
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
      // path keeps going instead of throwing (e.g. a window-glass shader).
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
