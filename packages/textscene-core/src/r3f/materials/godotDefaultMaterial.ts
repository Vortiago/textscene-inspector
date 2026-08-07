/**
 * Godot's default 3D material — what a surface with no material actually gets.
 *
 * It is NOT a `StandardMaterial3D` with default properties. Every backend binds
 * a hardcoded shader instead
 * (`RenderForwardClustered::_geometry_instance_add_surface` falls back to
 * `scene_shader.default_material`, whose code is built in
 * `SceneShaderForwardClustered::init` in
 * `servers/rendering/renderer_rd/forward_clustered/scene_shader_forward_clustered.cpp`,
 * and identically in the Mobile and Compatibility renderers):
 *
 *     void vertex()   { ROUGHNESS = 0.8; }
 *     void fragment() { ALBEDO = vec3(0.6); ROUGHNESS = 0.8; METALLIC = 0.2; }
 *
 * so an unmaterialed surface is a mid-grey, slightly metallic, mostly-rough
 * surface — not the white matte a default-constructed StandardMaterial3D would
 * give.
 *
 * The fallback is per SURFACE, not per mesh:
 * `RenderForwardClustered::_geometry_instance_update` walks every surface index
 * of the mesh and routes each through the same fallback, so a slot beyond the
 * material array gets this and nothing else. Its INSTANCE_MULTIMESH branch does
 * the same, which is what a GridMap tile draws through — `MeshLibrary::Item`
 * (`scene/resources/3d/mesh_library.h`) holds a mesh and no material, so a
 * library tile has no second source of one.
 *
 * `ALBEDO` is a shader constant, so 0.6 is LINEAR. It has to be built with an
 * explicit colour space — three decodes a plain hex literal as sRGB, which would
 * land at 0.318 linear instead.
 */

import * as THREE from 'three';

export const GODOT_DEFAULT_ALBEDO = new THREE.Color().setRGB(
  0.6,
  0.6,
  0.6,
  THREE.LinearSRGBColorSpace
);
export const GODOT_DEFAULT_ROUGHNESS = 0.8;
export const GODOT_DEFAULT_METALLIC = 0.2;
