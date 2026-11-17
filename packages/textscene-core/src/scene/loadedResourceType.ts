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

/** The class `load` gives the file, or null for a missing file, which the renderer then reports. */
export async function loadedResourceType(provider: ResourceProvider, path: string): Promise<string | null> {
  const lower = path.toLowerCase();
  if (lower.endsWith(TEXT_SCENE_EXTENSION)) return 'PackedScene';
  if (lower.endsWith(TEXT_RESOURCE_EXTENSION)) return textResourceType(provider, path);
  return importedResourceType(provider, path);
}
