/**
 * What Godot 4.6.3's glTF importer reads (`modules/gltf`). It skips an optional extension
 * outside this set and refuses a whole file that requires one (`gltf_document.cpp:7197-7202`).
 */

/**
 * `get_supported_gltf_extensions_hashset` (`gltf_document.cpp:6787-6806`): the eight that
 * `GLTFDocument` reads itself, then those of the extension classes `register_types.cpp:133-136`
 * registers. No other module registers one, and `ConvertImporterMesh` (`:139`) supports none.
 */
export const GODOT_GLTF_EXTENSIONS: ReadonlySet<string> = new Set([
  'GODOT_single_root',
  'KHR_animation_pointer',
  'KHR_lights_punctual',
  'KHR_materials_emissive_strength',
  'KHR_materials_pbrSpecularGlossiness',
  'KHR_materials_unlit',
  'KHR_node_visibility',
  'KHR_texture_transform',
  // `gltf_document_extension_physics.cpp:80-82`.
  'OMI_collider',
  'OMI_physics_body',
  'OMI_physics_shape',
  // `gltf_document_extension_texture_ktx.cpp:43`.
  'KHR_texture_basisu',
  // `gltf_document_extension_texture_webp.cpp:43`.
  'EXT_texture_webp',
]);

/** The `extensionsRequired` entries Godot cannot import. Any entry refuses the whole file. */
export function unsupportedRequiredGltfExtensions(required: readonly string[]): string[] {
  return required.filter((name) => !GODOT_GLTF_EXTENSIONS.has(name));
}
