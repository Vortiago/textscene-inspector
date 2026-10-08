/**
 * One error per registered resource slot whose reference names an id the file never declares. The loader resolves it
 * while it tokenises the value, before any setter, and fails the whole load on a miss (`resource_format_text.cpp:113`,
 * and the ext twin at `:138`). The registry says which keys are slots (`createResourceReferenceValidator` marks them).
 */

import type { BuiltSection, RawNode, RawScene } from '../parser/types.js';
import type { Diagnostic, SourceLines } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';
import { propertyLocation } from './sourceLocation.js';
import { validatorRegistry, type PropertyValidator } from './ValidatorRegistry.js';
import { isResourceSlotValidator } from './validators/resourceValidators.js';
import { resourceRef } from '../godot/index.js';

/** The ids a body may name: ext ids are all known up front, int ids accrue. */
interface Declared {
  readonly ext: ReadonlySet<string>;
  readonly int: ReadonlySet<string>;
}

/** One section whose body the sweep reads: a node, a sub-resource named by its `id=`, or a `.tres` body. */
interface Owner {
  /** What the scan built from the section, the key into `SourceLines`. */
  readonly built: BuiltSection;
  readonly name: string;
  readonly type: string;
  readonly rawProperties: Record<string, string>;
}

/**
 * Whether the declaration for `key` is a resource slot. An indexed family registers one dispatcher for
 * `item_<i>/<leaf>`, which forwards to exactly one leaf. So its accepting a reference literal means a resource leaf did:
 * no family that declares a resource leaf declares a `v.any()` leaf beside it.
 */
function isResourceSlot(declaration: PropertyValidator, key: string, value: string): boolean {
  if (isResourceSlotValidator(declaration)) return true;
  const leaves = declaration.leaves;
  if (!leaves?.some(isResourceSlotValidator)) return false;
  return declaration(key, value, 0) === null;
}

function sweep(
  owner: Owner,
  declared: Declared,
  declaredLater: ReadonlySet<string>,
  lines: SourceLines,
  into: Diagnostic[]
): void {
  for (const [key, value] of Object.entries(owner.rawProperties)) {
    const ref = resourceRef(value.trim());
    // Not a well-formed reference: its format is the strict parser's diagnostic, and a second error naming a
    // missing resource would be wrong.
    if (ref === null) continue;
    const table = ref.kind === 'SubResource' ? declared.int : declared.ext;
    if (table.has(ref.id)) continue;
    const declaration = validatorRegistry.declarationFor(owner.type, key);
    if (!declaration || !isResourceSlot(declaration, key, value)) continue;
    const where =
      ref.kind === 'SubResource' && declaredLater.has(ref.id)
        ? 'an id declared only later in this file, which the loader has not created yet'
        : 'an id this file never declares';
    into.push(
      armDiagnostic(
        FILE_DIAGNOSTICS.danglingResourceReference,
        owner,
        `Property '${key}' references ${value.trim()}, ${where}. Godot fails to load the file.`,
        propertyLocation(lines, owner.built, key)
      )
    );
  }
}

/** Each dangling reference, on the line of the property that holds it. */
export function danglingResourceDiagnostics(scene: RawScene, lines: SourceLines): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const ext = new Set((scene.externalResources ?? []).map((r) => r.id));
  const int = new Set<string>();
  const all = new Set((scene.internalResources ?? []).map((r) => r.id));

  // File order: `int_resources[id] = res` lands as each heading is read (`:629`), ahead of its body, so a body sees
  // the ids above it and its own, and a forward reference dangles.
  for (const resource of scene.internalResources ?? []) {
    int.add(resource.id);
    const owner: Owner = {
      built: resource,
      name: resource.id,
      type: resource.type,
      rawProperties: resource.data,
    };
    sweep(owner, { ext, int }, all, lines, diagnostics);
  }

  const declared: Declared = { ext, int };
  const none: ReadonlySet<string> = new Set();
  // A `.tres` body parses at `:774` with the ext and sub callbacks set at `:1191-1192`, after every sub-resource.
  if (scene.mainResource) {
    const { mainResource } = scene;
    const owner: Owner = {
      built: mainResource,
      name: '<unknown>',
      type: scene.resourceType ?? '',
      rawProperties: mainResource.data,
    };
    sweep(owner, declared, none, lines, diagnostics);
  }
  const visit = (node: RawNode): void => {
    const { name, type, rawProperties } = node;
    sweep({ built: node, name, type, rawProperties }, declared, none, lines, diagnostics);
    for (const child of node.children) visit(child);
  };
  for (const node of scene.nodes) visit(node);
  return diagnostics;
}
