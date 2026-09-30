/**
 * One error per used `[ext_resource]` whose glTF file Godot's importer refuses. A file that requires an extension
 * outside the importer's set never imports (`gltf_document.cpp:7197-7202`), so its resource never loads, and the text
 * loader aborts the whole scene with `ERR_FILE_MISSING_DEPENDENCIES` where a value names it
 * (`resource_format_text.cpp:145-151`, with `abort_on_missing_resource = true` at `resource_loader.cpp:1566`).
 */

import type { TscnExternalResource, TscnScene } from '../parser/types.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { FileEventBus } from '../resources/FileEventBus.js';
import {
  gltfRefusalMessage,
  isGltfPath,
  readGltfRequiredExtensions,
  unsupportedRequiredGltfExtensions,
} from '../godot/index.js';
import type { Diagnostic, SourceLines } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';
import { headingLocation } from './sourceLocation.js';
import { usedExtResourceIds } from './usedExtResources.js';

/**
 * Whether the rule reads `resource`'s file. `res://` only: a relative path or a `uid=` would need the loader's own
 * resolution (`resource_format_text.cpp:490-513`), which this does not repeat, so such a reference stays silent.
 */
function isReadableGltf(resource: TscnExternalResource): boolean {
  return resource.path.startsWith('res://') && isGltfPath(resource.path);
}

/**
 * The required extensions of `resource`'s file that Godot refuses. Empty for a file the provider does not hold or
 * cannot read, and for JSON Godot cannot parse: those are the missing-resource path, not this rule's claim.
 */
async function refusedExtensions(files: FileEventBus, resource: TscnExternalResource): Promise<string[]> {
  const data = await files.tryLoad(resource.path, resource.type);
  if (data === null) return [];
  return unsupportedRequiredGltfExtensions(readGltfRequiredExtensions(data) ?? []);
}

function refusal(resource: TscnExternalResource, unsupported: readonly string[], lines: SourceLines): Diagnostic {
  return armDiagnostic(
    FILE_DIAGNOSTICS.unimportableGltf,
    { name: resource.id, type: resource.type },
    `ExtResource("${resource.id}") loads ${resource.path}, whose ${gltfRefusalMessage(unsupported)}. ` +
      'The import fails, so Godot fails to load the scene.',
    headingLocation(lines, resource)
  );
}

/** Each used glTF dependency Godot refuses to import, on its `[ext_resource]` heading, read through `provider`. */
export async function unimportableGltfDiagnostics(
  scene: TscnScene,
  lines: SourceLines,
  provider: ResourceProvider
): Promise<Diagnostic[]> {
  const used = usedExtResourceIds(scene);
  const files = new FileEventBus(provider);
  const candidates = scene.externalResources.filter((r) => used.has(r.id) && isReadableGltf(r));
  const verdicts = await Promise.all(
    candidates.map(async (resource) => ({ resource, unsupported: await refusedExtensions(files, resource) }))
  );
  return verdicts
    .filter(({ unsupported }) => unsupported.length > 0)
    .map(({ resource, unsupported }) => refusal(resource, unsupported, lines));
}
