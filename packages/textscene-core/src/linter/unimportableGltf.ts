/**
 * One diagnostic per used `[ext_resource]` whose glTF file Godot's importer refuses (`gltf_document.cpp:7197-7202`).
 * Its resource never loads, so the text loader raises `ERR_FILE_MISSING_DEPENDENCIES` where a value names it
 * (`resource_format_text.cpp:146-154`, `abort_on_missing_resource` at `resource_loader.cpp:1566`). An aborting use
 * fails the file's load: an error unless code in the project may add the extension. A use only in nodes leaves the
 * scene loadable (`:288-289`): always a warning.
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
import { extResourceUses, type ExtResourceUse } from './usedExtResources.js';

/**
 * Whether the rule reads `resource`'s file: a glTF at a `res://` path. The loader takes a known `uid=` over `path=`
 * (`resource_format_text.cpp:490-494`), and the rule reads `path=`, the same file unless it moved outside the editor.
 * A relative path needs the loader's own resolution (`:508-511`), which this does not repeat, so it stays silent.
 */
function isReadableGltf(resource: TscnExternalResource): boolean {
  return resource.path.startsWith('res://') && isGltfPath(resource.path);
}

/** A readable glTF `[ext_resource]` a value uses, and where its uses sit. */
export interface UsedGltf {
  readonly resource: TscnExternalResource;
  readonly use: ExtResourceUse;
}

/**
 * The `[ext_resource]`s whose glTF files the rule reads: a readable glTF a value uses. A later declaration of an id
 * replaces an earlier one (`resource_format_text.cpp:517-519`), and a use loads the one it names (`:142-144`). The
 * readable filter runs first, so a scene with no glTF walks no value.
 */
export function usedGltfResources(scene: TscnScene): UsedGltf[] {
  const lastById = new Map(scene.externalResources.map((resource) => [resource.id, resource] as const));
  const readable = [...lastById.values()].filter(isReadableGltf);
  if (readable.length === 0) return [];
  const uses = extResourceUses(scene);
  return readable.flatMap((resource) => {
    const use = uses.get(resource.id);
    return use === undefined ? [] : [{ resource, use }];
  });
}

interface Refusal extends UsedGltf {
  readonly unsupported: readonly string[];
}

const NOTHING_CAN_ADD =
  ' The project enables no editor plugin, declares no autoload and holds no GDExtension, so nothing can add support.';

const UNLESS_A_PLUGIN_ADDS =
  ' Unless an editor plugin, an autoload or a GDExtension of this project registers a GLTFDocumentExtension that ' +
  'adds support, the import fails';

// "The file", not "the scene": a `.tres` whose `[resource]` body names the glTF fails to load as well.
const LOAD_FAILS = 'Godot fails to load the file.';

// Only a `.tscn` has nodes, so a node use is always in a scene.
const NODE_LEFT_OUT =
  'the editor reports a broken dependency, and a running game loads the scene without it: a node that instances ' +
  'it is missing, and a node property that names it is null.';

/** The arm a refusal reports under, and the sentences that close its message. */
interface Outcome {
  readonly arm: RuleArm;
  readonly closing: string;
}

/** What a refusal used as `use` does, where `extensible` says whether code in the project may add the extension. */
function outcomeOf(use: ExtResourceUse, extensible: boolean): Outcome {
  if (use === 'node') {
    const closing = extensible
      ? `${UNLESS_A_PLUGIN_ADDS}. Then ${NODE_LEFT_OUT}`
      : `${NOTHING_CAN_ADD} The import fails, so ${NODE_LEFT_OUT}`;
    return { arm: FILE_DIAGNOSTICS.unimportableGltfInNode, closing };
  }
  return extensible
    ? {
        arm: FILE_DIAGNOSTICS.unimportableGltfUnlessPlugin,
        closing: `${UNLESS_A_PLUGIN_ADDS}, and ${LOAD_FAILS}`,
      }
    : {
        arm: FILE_DIAGNOSTICS.unimportableGltf,
        closing: `${NOTHING_CAN_ADD} The import fails, so ${LOAD_FAILS}`,
      };
}

/** One refusal on its `[ext_resource]` heading, under the arm and message its use and `extensible` decide. */
function report(
  { resource, use, unsupported }: Refusal,
  lines: SourceLines,
  extensible: boolean
): Diagnostic {
  const { arm, closing } = outcomeOf(use, extensible);
  const refused = `ExtResource("${resource.id}") loads ${resource.path}, whose ${gltfRefusalMessage(unsupported)}.`;
  const location = headingLocation(lines, resource);
  return armDiagnostic(arm, { name: resource.id, type: resource.type }, refused + closing, location);
}

/** The per-provider caches the rule reads the project through, kept for a linter's lifetime. */
export interface ProjectReads {
  readonly verdicts: GltfVerdicts;
  readonly plugins: ProjectPluginProbes;
}

/**
 * Each of `used` whose glTF Godot refuses to import, on its `[ext_resource]` heading, read through `provider`. The
 * plugin probe reads the project files beside the glTF reads, so a refusal waits for neither in turn, and its answer,
 * which may list the project, is asked for only when a file is refused.
 */
export async function unimportableGltfDiagnostics(
  used: readonly UsedGltf[],
  lines: SourceLines,
  provider: ResourceProvider,
  reads: ProjectReads
): Promise<Diagnostic[]> {
  const mayBeExtended = reads.plugins.probe(provider);
  const found = await Promise.all(
    used.map(async (gltf) => ({
      ...gltf,
      unsupported: await reads.verdicts.refused(provider, gltf.resource),
    }))
  );
  const refusals = found.filter(({ unsupported }) => unsupported.length > 0);
  if (refusals.length === 0) return [];
  const extensible = await mayBeExtended();
  return refusals.map((refusal) => report(refusal, lines, extensible));
}
