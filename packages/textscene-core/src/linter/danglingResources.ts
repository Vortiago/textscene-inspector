/**
 * One error per registered resource slot whose reference names an id the
 * file never declares.
 *
 * The text loader resolves `SubResource("id")` / `ExtResource("id")` while it
 * tokenises the VALUE, before any setter sees it, and fails the whole load on
 * a miss: `resource_format_text.cpp:113`
 * `ERR_FAIL_COND_V(!int_resources.has(id), ERR_INVALID_PARAMETER)` and the
 * ext twin at `:138`. The slot's class never enters into it, so the fact is
 * stated once here for every `v.resourceReference` registration rather than
 * per slice.
 *
 * Which keys are resource slots is the registry's answer, not a text scrape:
 * `createResourceReferenceValidator` marks every validator it builds. A
 * value phase 1 refused is not a reference and is skipped — its format is the
 * strict parser's diagnostic, and a second error naming a missing resource
 * would be wrong.
 *
 * `[sub_resource]` bodies are swept in file order because `int_resources[id]
 * = res` lands as each heading is read (`:629`), ahead of that body's own
 * properties: a body sees the ids above it and its own, and a forward
 * reference dangles.
 */

import type { TscnNode, TscnScene } from '../parser/types.js';
import type { Diagnostic } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';
import { validatorRegistry, type PropertyValidator } from './ValidatorRegistry.js';
import { isResourceSlotValidator } from './validators/resourceValidators.js';
import { resourceRef } from '../godot/index.js';

/** The ids a body may name: ext ids are all known up front, int ids accrue. */
interface Declared {
  readonly ext: ReadonlySet<string>;
  readonly int: ReadonlySet<string>;
}

/**
 * Whether the declaration for `key` is a resource slot.
 *
 * An indexed family registers ONE dispatcher for `item_<i>/<leaf>`, so the
 * declaration is the dispatcher and the leaf it routes to is not named. The
 * dispatcher forwards to exactly one leaf, so it accepting a reference literal
 * means that leaf did — and only a resource leaf accepts one: no family that
 * declares a resource leaf declares a `v.any()` leaf beside it.
 */
function isResourceSlot(declaration: PropertyValidator, key: string, value: string): boolean {
  if (isResourceSlotValidator(declaration)) return true;
  const leaves = declaration.leaves;
  if (!leaves?.some(isResourceSlotValidator)) return false;
  return declaration(key, value, 0) === null;
}

function sweep(
  ownerType: string,
  owner: { name: string; type: string },
  properties: Record<string, unknown>,
  declared: Declared,
  declaredLater: ReadonlySet<string>,
  into: Diagnostic[]
): void {
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== 'string') continue;
    const ref = resourceRef(value.trim());
    if (ref === null) continue;
    const table = ref.kind === 'SubResource' ? declared.int : declared.ext;
    if (table.has(ref.id)) continue;
    const declaration = validatorRegistry.declarationFor(ownerType, key);
    if (!declaration || !isResourceSlot(declaration, key, value)) continue;
    const where =
      ref.kind === 'SubResource' && declaredLater.has(ref.id)
        ? 'an id declared only later in this file, which the loader has not created yet'
        : 'an id this file never declares';
    into.push(
      armDiagnostic(
        FILE_DIAGNOSTICS.danglingResourceReference,
        owner,
        `Property '${key}' references ${value.trim()}, ${where}. Godot fails to load the scene.`
      )
    );
  }
}

export function danglingResourceDiagnostics(scene: TscnScene): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const ext = new Set((scene.externalResources ?? []).map((r) => r.id));
  const int = new Set<string>();
  const all = new Set((scene.internalResources ?? []).map((r) => r.id));

  for (const resource of scene.internalResources ?? []) {
    int.add(resource.id);
    // `id` sits in `data` beside the properties (`parseInternalResource`).
    const { id: _id, ...properties } = resource.data;
    sweep(resource.type, { name: resource.id, type: resource.type }, properties, { ext, int }, all, diagnostics);
  }

  const declared: Declared = { ext, int };
  const none: ReadonlySet<string> = new Set();
  const visit = (node: TscnNode): void => {
    sweep(node.type, node, node.properties as Record<string, unknown>, declared, none, diagnostics);
    for (const child of node.children) visit(child);
  };
  for (const node of scene.nodes) visit(node);
  return diagnostics;
}
