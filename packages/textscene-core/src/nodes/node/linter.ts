/**
 * Node-universal semantic rule (no applicableNodeTypes, so it runs for every node): a reference to
 * a binary Godot scene is marked "not previewable", since the previewer loads only text scenes
 * (`.tscn`) and the content degrades to a missing-resource placeholder. The previewer reads any
 * other `.res`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../linter/types.js';
import { ruleRegistry } from '../../linter/RuleRegistry.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../linter/ruleArms.js';
import { resourceRef } from '../../godot/variant/resourceRef.js';
import { findExtResource } from '../../resources/SubResourceResolver.js';
import { isBinaryScenePath } from '../../godot/project/binaryResourceFormat.js';

/** One arm, so the rule reports `<unknown>` for a heading with no type, as every other rule does. */
const arms = {
  binaryReference: groundedArm('binary-resource-reference', {
    kind: 'no-engine-counterpart',
    scope: 'previewer-limitation',
    because: 'this previewer decodes only a text .tscn scene, never a binary .scn or .res one',
  }),
} as const satisfies RuleArms<string>;

function checkBinaryResourceReferences(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  const flag = (property: string, path: string) => {
    reportArm(
      diagnostics,
      arms.binaryReference,
      node,
      `'${property}' references a binary Godot scene (${path}): ` +
        `the previewer only loads text scenes (.tscn), so this content shows as missing.`
    );
  };

  const extResourceOf = (ref: string) => {
    const parsed = resourceRef(ref);
    return parsed?.kind === 'ExtResource' ? findExtResource(scene.externalResources, parsed.id) : undefined;
  };

  // An instance loads as a PackedScene whatever its `type=` says, as the scene processor reads it.
  const instanced = node.instance ? extResourceOf(node.instance) : undefined;
  if (instanced && isBinaryScenePath(instanced.path, 'PackedScene')) flag('instance', instanced.path);
  for (const [key, value] of Object.entries(node.rawProperties)) {
    const ext = extResourceOf(value);
    if (ext && isBinaryScenePath(ext.path, ext.type)) flag(key, ext.path);
  }

  return diagnostics;
}

const binaryResourceRule: LintRule = {
  meta: {
    name: 'binary-resource-reference',
    description: 'Flags references to binary Godot scenes (.scn, .res) the previewer cannot load',
    category: 'validation',
    emits: armEmits(arms),
  },
  check: checkBinaryResourceReferences,
};

ruleRegistry.register(binaryResourceRule);
