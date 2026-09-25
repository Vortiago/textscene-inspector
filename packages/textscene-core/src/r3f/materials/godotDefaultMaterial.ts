/**
 * Godot's default 3D material, a hardcoded shader rather than a default
 * StandardMaterial3D: `_geometry_instance_add_surface` falls back to
 * `scene_shader.default_material` (`SceneShaderForwardClustered::init` in
 * `servers/rendering/renderer_rd/forward_clustered/scene_shader_forward_clustered.cpp`), as Mobile and Compatibility do.
 */

import * as THREE from 'three';

// Per surface: `RenderForwardClustered::_geometry_instance_update` sends every
// surface index through the fallback, as its INSTANCE_MULTIMESH branch does for a
// GridMap tile, whose `MeshLibrary::Item` (`scene/resources/3d/mesh_library.h`)
// holds no material.

/**
 * `ALBEDO = vec3(0.6)` in `fragment()`, a shader constant and so linear: three
 * reads a plain hex literal as sRGB, which lands at 0.318 linear.
 */
export const GODOT_DEFAULT_ALBEDO = new THREE.Color().setRGB(
  0.6,
  0.6,
  0.6,
  THREE.LinearSRGBColorSpace
);
/** `ROUGHNESS = 0.8`, in both `vertex()` and `fragment()`. */
export const GODOT_DEFAULT_ROUGHNESS = 0.8;
/** `METALLIC = 0.2` in `fragment()`. */
export const GODOT_DEFAULT_METALLIC = 0.2;
