/**
 * Godot's default 3D material, a hardcoded shader rather than a default
 * StandardMaterial3D: `_geometry_instance_add_surface` falls back to
 * `scene_shader.default_material` (`SceneShaderForwardClustered::init` in
 * `servers/rendering/renderer_rd/forward_clustered/scene_shader_forward_clustered.cpp`), as Mobile and Compatibility do.
 */

import * as THREE from 'three';
import { DEFAULT_MATERIAL_ALBEDO } from '../../godot/rendering/materials/defaultMaterial';
import { DiffuseMode } from '../../godot/rendering/materials/diffuseMode';
import { SpecularMode } from '../../godot/rendering/materials/specularMode';
import type { LightModes } from '../lightModes';

// Per surface: `RenderForwardClustered::_geometry_instance_update` sends every
// surface index through the fallback, as its INSTANCE_MULTIMESH branch does for a
// GridMap tile, whose `MeshLibrary::Item` (`scene/resources/3d/mesh_library.h`)
// holds no material.

/** The albedo as a linear colour: three reads a plain hex literal as sRGB, which lands at 0.318 linear. */
export const GODOT_DEFAULT_ALBEDO = new THREE.Color().setRGB(
  DEFAULT_MATERIAL_ALBEDO,
  DEFAULT_MATERIAL_ALBEDO,
  DEFAULT_MATERIAL_ALBEDO,
  THREE.LinearSRGBColorSpace
);
/**
 * The shader names no render mode, and a spatial shader without one draws Lambert diffuse
 * (`shader_types.cpp:241`) and GGX specular (`scene_forward_clustered.glsl:1078-1080`).
 */
export const GODOT_DEFAULT_LIGHT_MODES: LightModes = {
  diffuseMode: DiffuseMode.DIFFUSE_LAMBERT,
  specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
};
