/**
 * One error per used `[ext_resource]` whose glTF file Godot's importer refuses. A file that requires an extension
 * outside the importer's set never imports (`gltf_document.cpp:7197-7202`), so its resource never loads, and the text
 * loader aborts the whole scene with `ERR_FILE_MISSING_DEPENDENCIES` where a value names it
 * (`resource_format_text.cpp:145-151`, with `abort_on_missing_resource = true` at `resource_loader.cpp:1566`).
 */

import type { TscnExternalResource, TscnScene } from '../parser/types.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
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
 * The `[ext_resource]`s whose glTF files the rule reads: a readable glTF a value uses. The readable filter runs first,
 * so a scene with no glTF walks no value.
 */
export function usedGltfResources(scene: TscnScene): TscnExternalResource[] {
  const readable = scene.externalResources.filter(isReadableGltf);
  if (readable.length === 0) return [];
  const used = usedExtResourceIds(scene);
  return readable.filter((resource) => used.has(resource.id));
}

/**
 * The required extensions of `resource`'s file that Godot refuses. Empty for a file the provider does not hold or
 * cannot read, and for JSON Godot cannot parse: those are the missing-resource path, not this rule's claim. A rejection
 * counts as a miss, since the VS Code and web providers throw for a missing file where the contract says null.
 */
async function refusedExtensions(provider: ResourceProvider, resource: TscnExternalResource): Promise<string[]> {
  const data = await provider.loadResource(resource.path, resource.type).catch(() => null);
  if (data === null) return [];
  return unsupportedRequiredGltfExtensions(readGltfRequiredExtensions(data));
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

/** Each of `resources` whose glTF Godot refuses to import, on its `[ext_resource]` heading, read through `provider`. */
export async function unimportableGltfDiagnostics(
  resources: readonly TscnExternalResource[],
  lines: SourceLines,
  provider: ResourceProvider
): Promise<Diagnostic[]> {
  const verdicts = await Promise.all(
    resources.map(async (resource) => ({ resource, unsupported: await refusedExtensions(provider, resource) }))
  );
  return verdicts
    .filter(({ unsupported }) => unsupported.length > 0)
    .map(({ resource, unsupported }) => refusal(resource, unsupported, lines));
}
