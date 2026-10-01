/**
 * One diagnostic per used `[ext_resource]` whose glTF file Godot's importer refuses (`gltf_document.cpp:7197-7202`).
 * Its resource never loads, so the text loader aborts the scene where a value names it (`resource_format_text.cpp:145-151`,
 * `abort_on_missing_resource` at `resource_loader.cpp:1566`). A warning unless the project shows nothing can add one.
 */

import type { TscnExternalResource, TscnScene } from '../parser/types.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { gltfRefusalMessage, isGltfPath } from '../godot/index.js';
import type { Diagnostic, SourceLines } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import type { GltfVerdicts } from './gltfVerdicts.js';
import type { ProjectPluginProbes } from './projectPlugins.js';
import { armDiagnostic, type RuleArm } from './ruleArms.js';
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

// "The file", not "the scene": a `.tres` whose `[resource]` body names the glTF fails to load as well.
const NOTHING_CAN_ADD =
  ' The project enables no editor plugin, declares no autoload and holds no GDExtension, so nothing can add support. ' +
  'The import fails, so Godot fails to load the file.';

const A_PLUGIN_MAY_ADD =
  ' Unless an editor plugin, an autoload or a GDExtension of this project registers a GLTFDocumentExtension that ' +
  'adds support, the import fails, and Godot fails to load the file.';

/** One refusal on its `[ext_resource]` heading, under `arm`, its message closed by `outcome`. */
function report(
  arm: RuleArm,
  { resource, unsupported }: Refusal,
  lines: SourceLines,
  outcome: string
): Diagnostic {
  const refused = `ExtResource("${resource.id}") loads ${resource.path}, whose ${gltfRefusalMessage(unsupported)}.`;
  const location = headingLocation(lines, resource);
  return armDiagnostic(arm, { name: resource.id, type: resource.type }, refused + outcome, location);
}

/** The per-provider caches the rule reads the project through, kept for a linter's lifetime. */
export interface ProjectReads {
  readonly verdicts: GltfVerdicts;
  readonly plugins: ProjectPluginProbes;
}

/**
 * Each of `resources` whose glTF Godot refuses to import, on its `[ext_resource]` heading, read through `provider`.
 * The plugin probe reads the project files beside the glTF reads, so a refusal waits for neither in turn, and its
 * answer, which may list the project, is asked for only when a file is refused.
 */
export async function unimportableGltfDiagnostics(
  resources: readonly TscnExternalResource[],
  lines: SourceLines,
  provider: ResourceProvider,
  reads: ProjectReads
): Promise<Diagnostic[]> {
  const mayBeExtended = reads.plugins.probe(provider);
  const found = await Promise.all(
    resources.map(async (resource) => ({
      resource,
      unsupported: await reads.verdicts.refused(provider, resource),
    }))
  );
  const refusals = found.filter(({ unsupported }) => unsupported.length > 0);
  if (refusals.length === 0) return [];
  const extensible = await mayBeExtended();
  return refusals.map((refusal) =>
    extensible
      ? report(FILE_DIAGNOSTICS.unimportableGltfUnlessPlugin, refusal, lines, A_PLUGIN_MAY_ADD)
      : report(FILE_DIAGNOSTICS.unimportableGltf, refusal, lines, NOTHING_CAN_ADD)
  );
}
