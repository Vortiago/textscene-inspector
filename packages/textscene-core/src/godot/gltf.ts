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

/**
 * The `extensionsRequired` entries of a parsed glTF document. `_parse_gltf_extensions` converts the
 * array to `Vector<String>` (`gltf_document.cpp:7192-7195`), which stringifies each entry
 * (`variant.cpp:2082-2091`). So a non-string entry becomes a name no importer supports, and is kept.
 * Empty for a document that is not an object, or whose `extensionsRequired` is not an array.
 */
export function requiredGltfExtensions(json: unknown): string[] {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return [];
  const required: unknown = (json as { extensionsRequired?: unknown }).extensionsRequired;
  if (!Array.isArray(required)) return [];
  return required.map((name) => (typeof name === 'string' ? name : JSON.stringify(name)));
}

/** `glTF` read as a little-endian `uint32`, which `_parse` tests the first four bytes against (`gltf_document.cpp:6514-6515`). */
const GLB_MAGIC = 0x46546c67;
/** `JSON` as a chunk type, which the first chunk of a GLB must carry (`gltf_document.cpp:283`). */
const GLB_JSON_CHUNK = 0x4e4f534a;
/** The 12-byte file header, then the first chunk's length and type (`gltf_document.cpp:276-281`). */
const GLB_JSON_CHUNK_OFFSET = 20;

/**
 * The JSON text of a GLB's first chunk, or null where `_parse_glb` refuses the file: a first chunk
 * that is not JSON (`gltf_document.cpp:283`), or one shorter than its declared length (`:287`).
 */
function glbJsonText(bytes: Uint8Array): string | null {
  if (bytes.length < GLB_JSON_CHUNK_OFFSET) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== GLB_JSON_CHUNK) return null;
  if (bytes.length - GLB_JSON_CHUNK_OFFSET < chunkLength) return null;
  return new TextDecoder().decode(bytes.subarray(GLB_JSON_CHUNK_OFFSET, GLB_JSON_CHUNK_OFFSET + chunkLength));
}

/**
 * The JSON text Godot parses from a glTF file. `_parse` chooses by the magic alone, never by the
 * file's extension (`gltf_document.cpp:6514-6530`): a GLB container, or else the whole file as UTF-8.
 */
function gltfJsonText(data: ArrayBuffer | string): string | null {
  if (typeof data === 'string') return data;
  const bytes = new Uint8Array(data);
  const isGlb = bytes.length >= 4 && new DataView(data).getUint32(0, true) === GLB_MAGIC;
  return isGlb ? glbJsonText(bytes) : new TextDecoder().decode(bytes);
}

/**
 * The `extensionsRequired` list of a `.glb` or `.gltf` file's bytes, or null where Godot cannot read
 * its JSON: a refused GLB container, text that is not JSON, or JSON that is not an object. A string is
 * a text glTF a host has already decoded.
 */
export function readGltfRequiredExtensions(data: ArrayBuffer | string): string[] | null {
  const text = gltfJsonText(data);
  if (text === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // `JSON::parse` refuses the text (`gltf_document.cpp:6527-6528`), so the file never imports.
    return null;
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  return requiredGltfExtensions(json);
}

/** Why Godot refuses a file that requires `unsupported`, naming every extension, as `gltf_document.cpp:7200` does. */
export function gltfRefusalMessage(unsupported: readonly string[]): string {
  const names = unsupported.map((name) => `'${name}'`).join(', ');
  return unsupported.length === 1
    ? `required extension ${names} is not supported by Godot's glTF importer`
    : `required extensions ${names} are not supported by Godot's glTF importer`;
}

/**
 * The extensions the glTF importer claims (`editor_scene_importer_gltf.cpp:36-38`), dotted for a
 * suffix test. The scene importer lowercases a source's extension before matching it
 * (`resource_importer_scene.cpp:2972`).
 */
const GLTF_EXTENSIONS = ['.glb', '.gltf'] as const;

/** Whether `path` names a file Godot's glTF importer reads, case-insensitive like the importer. */
export function isGltfPath(path: string): boolean {
  const lower = path.toLowerCase();
  return GLTF_EXTENSIONS.some((extension) => lower.endsWith(extension));
}
