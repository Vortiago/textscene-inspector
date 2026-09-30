/**
 * One diagnostic per used `[ext_resource]` whose glTF file Godot's importer refuses. A file that requires an extension
 * outside the importer's set never imports (`gltf_document.cpp:7197-7202`), so its resource never loads, and the text
 * loader aborts the whole scene with `ERR_FILE_MISSING_DEPENDENCIES` where a value names it
 * (`resource_format_text.cpp:145-151`, with `abort_on_missing_resource = true` at `resource_loader.cpp:1566`). It is an
 * error where nothing in the project can add an extension, and a warning where an editor plugin or a GDExtension can.
 */

import type { TscnExternalResource, TscnScene } from '../parser/types.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { gltfRefusalMessage, isGltfPath } from '../godot/index.js';
import type { Diagnostic, SourceLines } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import type { GltfVerdicts } from './gltfVerdicts.js';
import { projectMayExtendGltfImport } from './projectPlugins.js';
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

interface Refusal {
  readonly resource: TscnExternalResource;
  readonly unsupported: readonly string[];
}

function refusalDiagnostic({ resource, unsupported }: Refusal, lines: SourceLines, mayBeExtended: boolean): Diagnostic {
  const refused = `ExtResource("${resource.id}") loads ${resource.path}, whose ${gltfRefusalMessage(unsupported)}.`;
  const outcome = mayBeExtended
    ? ' Unless an editor plugin or a GDExtension of this project registers a GLTFDocumentExtension that supports it, ' +
      'the import fails, and Godot fails to load the scene.'
    : ' The project enables no editor plugin and loads no GDExtension, so nothing can add it. ' +
      'The import fails, so Godot fails to load the scene.';
  return armDiagnostic(
    mayBeExtended ? FILE_DIAGNOSTICS.unimportableGltfUnlessPlugin : FILE_DIAGNOSTICS.unimportableGltf,
    { name: resource.id, type: resource.type },
    refused + outcome,
    headingLocation(lines, resource)
  );
}

/**
 * Each of `resources` whose glTF Godot refuses to import, on its `[ext_resource]` heading, read through `provider`.
 * The project's plugin files are read only when a file is refused.
 */
export async function unimportableGltfDiagnostics(
  resources: readonly TscnExternalResource[],
  lines: SourceLines,
  provider: ResourceProvider,
  verdicts: GltfVerdicts
): Promise<Diagnostic[]> {
  const found = await Promise.all(
    resources.map(async (resource) => ({ resource, unsupported: await verdicts.refused(provider, resource) }))
  );
  const refusals = found.filter(({ unsupported }) => unsupported.length > 0);
  if (refusals.length === 0) return [];
  const mayBeExtended = await projectMayExtendGltfImport(provider);
  return refusals.map((refusal) => refusalDiagnostic(refusal, lines, mayBeExtended));
}
