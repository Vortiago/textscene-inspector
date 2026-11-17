import { importSidecarPath } from '../godot/project/resourceFormats.js';
import { parseImportFile } from '../parser/importParser.js';
import { parseTresFile } from '../parser/parsedResource.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';

const TEXT_SCENE_EXTENSION = '.tscn';
const TEXT_RESOURCE_EXTENSION = '.tres';

async function textOf(provider: ResourceProvider, path: string): Promise<string | null> {
  const content = await provider.loadResource(path);
  return typeof content === 'string' ? content : null;
}

/** The `[gd_resource type=]` of a `.tres` file (`resource_format_text.cpp:1511-1530`). */
async function textResourceType(provider: ResourceProvider, path: string): Promise<string | null> {
  const text = await textOf(provider, path);
  if (text === null) return null;
  try {
    return parseTresFile(text).resourceType;
  } catch {
    // A text with no header loads as no resource, so its class is unknown.
    return null;
  }
}

/** The `[remap] type=` of an imported file's sidecar (`resource_importer.cpp:384-393`). */
async function importedResourceType(provider: ResourceProvider, path: string): Promise<string | null> {
  const sidecar = await textOf(provider, importSidecarPath(path));
  return (sidecar !== null && parseImportFile(sidecar)?.resourceType) || null;
}

/** The class a header-less loader names by extension alone (each `get_resource_type`, cited per row). */
const CLASS_BY_EXTENSION: ReadonlyMap<string, string> = new Map([
  ['gdshader', 'Shader'], // `shader.cpp:344`
  ['gdshaderinc', 'ShaderInclude'], // `shader_include.cpp:123`
  ['ctex', 'CompressedTexture2D'], // `compressed_texture.cpp:488`
  ['ctex3d', 'CompressedTexture3D'], // `compressed_texture.cpp:672`
  ['ctexarray', 'CompressedTexture2DArray'], // `compressed_texture.cpp:886`
  ['ccube', 'CompressedCubemap'],
  ['ccubearray', 'CompressedCubemapArray'],
  ['gd', 'GDScript'], // `gdscript.cpp:2927`
  ['gdc', 'GDScript'],
  ['ogv', 'VideoStreamTheora'], // `video_stream_theora.cpp:821`
  ['crt', 'X509Certificate'], // `crypto.cpp:217`
  ['key', 'CryptoKey'],
  ['pub', 'CryptoKey'],
  ['image', 'Image'], // `image_loader.cpp:208`
  ['json', 'JSON'], // `json.cpp:1597`
]);

const extensionOf = (lowerPath: string) => lowerPath.slice(lowerPath.lastIndexOf('.') + 1);

/** The class `load` gives, or null for a missing file and for a binary `.res` or `.scn`, unread here. */
export async function loadedResourceType(provider: ResourceProvider, path: string): Promise<string | null> {
  const lower = path.toLowerCase();
  if (lower.endsWith(TEXT_SCENE_EXTENSION)) return 'PackedScene';
  if (lower.endsWith(TEXT_RESOURCE_EXTENSION)) return textResourceType(provider, path);
  return (await importedResourceType(provider, path)) ?? CLASS_BY_EXTENSION.get(extensionOf(lower)) ?? null;
}
