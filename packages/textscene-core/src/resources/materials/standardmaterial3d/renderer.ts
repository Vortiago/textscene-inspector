/**
 * StandardMaterial3D renderer - creates THREE.js materials from StandardMaterial3D properties.
 */

import * as THREE from 'three';
import type { StandardMaterial3DProperties } from './types';
import { emissionScalars, resolveEmission } from './emission';
import { info } from '../../../logger';
import { applyTextureState } from '../../textures/applyTextureState';

/**
 * The texture this material samples: the shared cached one when it needs no
 * state of its own, otherwise a clone carrying its UV transform and sampler
 * filter. `applyTextureState` owns both; see it for why cloning is mandatory.
 *
 * Godot's `uv1_scale` maps to three's `repeat` directly (higher = more tiling).
 * `uv1_offset` is not parsed on this path yet, so it passes zero.
 */
function materialTexture(
  texture: THREE.Texture,
  properties: StandardMaterial3DProperties
): THREE.Texture {
  const result = applyTextureState(texture, {
    uv: properties.uv1_scale
      ? { scale: properties.uv1_scale, offset: { x: 0, y: 0 } }
      : undefined,
    filter: properties.texture_filter,
  });

  if (result !== texture) {
    info(
      `[StandardMaterial3D] Cloned texture for uv1_scale=${JSON.stringify(properties.uv1_scale)} texture_filter=${properties.texture_filter ?? '(default)'}`
    );
  }

  return result;
}

/**
 * Create a THREE.MeshStandardMaterial from StandardMaterial3D properties.
 * Maps Godot PBR properties to THREE.js equivalents.
 */
export function createStandardMaterial(properties: StandardMaterial3DProperties): THREE.MeshStandardMaterial {
  const materialOptions: THREE.MeshStandardMaterialParameters = {};

  // Map albedo_color to THREE.js color. Godot stores colors
  // in sRGB; three.js treats `new THREE.Color(r,g,b)` arguments as
  // linear. Without the conversion, mid-tone reds (e.g. Color(0.545,
  // 0.117, 0.117, 1) — dark red #8B1E1E in Godot) render as bright
  // saturated pink. Call `convertSRGBToLinear()` to undo the implicit
  // linearisation that three.js's shader output otherwise re-applies
  // via the renderer's outputColorSpace = SRGB.
  if (properties.albedo_color) {
    const { r, g, b, a } = properties.albedo_color;
    materialOptions.color = new THREE.Color(r, g, b).convertSRGBToLinear();

    // Handle transparency
    if (a < 1.0) {
      materialOptions.transparent = true;
      materialOptions.opacity = a;
    }
  }

  // Map metallic property (Godot and THREE.js both use 0-1 range)
  if (properties.metallic !== undefined) {
    materialOptions.metalness = properties.metallic;
  }

  // Map roughness property (Godot and THREE.js both use 0-1 range)
  if (properties.roughness !== undefined) {
    materialOptions.roughness = properties.roughness;
  }

  // Map texture properties and apply UV transforms
  if (properties.albedo_texture) {
    materialOptions.map = materialTexture(properties.albedo_texture, properties);
  }

  if (properties.normal_enabled && properties.normal_texture) {
    materialOptions.normalMap = materialTexture(properties.normal_texture, properties);
  }

  if (properties.metallic_texture) {
    materialOptions.metalnessMap = materialTexture(properties.metallic_texture, properties);
  }

  if (properties.roughness_texture) {
    materialOptions.roughnessMap = materialTexture(properties.roughness_texture, properties);
  }

  if (properties.ao_texture) {
    materialOptions.aoMap = materialTexture(properties.ao_texture, properties);
  }

  if (properties.emission_enabled) {
    if (properties.emission_texture) {
      materialOptions.emissiveMap = materialTexture(properties.emission_texture, properties);
    }
    // An emission colour and energy reach the material the same way they do on
    // the inline-SubResource path, through the one shared decomposition —
    // otherwise an external material's emission is the texture alone, unlit and
    // unmodulated, where Godot shows it at full energy.
    const scalars = emissionScalars(
      properties.emission,
      properties.emission_energy_multiplier ?? 1
    );
    const resolved = resolveEmission(
      scalars,
      properties.emission_operator,
      !!properties.emission_texture
    );
    materialOptions.emissive = new THREE.Color().fromArray(resolved.emissive);
    materialOptions.emissiveIntensity = resolved.emissiveIntensity;
  }

  return new THREE.MeshStandardMaterial(materialOptions);
}
