/**
 * Node-universal semantic rule (no applicableNodeTypes, so it runs for every node): a reference to
 * a binary Godot resource (`.scn`, `.res`) is marked "not previewable", since the previewer loads
 * only text formats (`.tscn`, `.tres`) and the content degrades to a missing-resource placeholder.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../linter/types.js';
import { ruleRegistry } from '../../linter/RuleRegistry.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../linter/ruleArms.js';
import { resourceRef } from '../../godot/index.js';
import { findExtResource } from '../../resources/SubResourceResolver.js';

const BINARY_RESOURCE_RE = /\.(scn|res)$/i;

/** One arm, so the rule reports `<unknown>` for a heading with no type, as every other rule does. */
const arms = {
  binaryReference: groundedArm('binary-resource-reference', {
    kind: 'no-engine-counterpart',
    scope: 'previewer-limitation',
    because: 'this previewer decodes only text .tscn/.tres, never a binary .scn/.res payload',
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
      `'${property}' references a binary Godot resource (${path}) — ` +
        `the previewer only loads text resources (.tscn/.tres), so this content shows as missing.`
    );
  };

  const pathForRef = (ref: string): string | null => {
    const parsed = resourceRef(ref);
    if (parsed?.kind !== 'ExtResource') return null;
    const ext = findExtResource(scene.externalResources, parsed.id);
    return ext && BINARY_RESOURCE_RE.test(ext.path) ? ext.path : null;
  };

  if (node.instance) {
    const path = pathForRef(node.instance);
    if (path) flag('instance', path);
  }
  for (const [key, value] of Object.entries(node.rawProperties)) {
    const path = pathForRef(value);
    if (path) flag(key, path);
  }

  return diagnostics;
}

const binaryResourceRule: LintRule = {
  meta: {
    name: 'binary-resource-reference',
    description: 'Flags references to binary Godot resources (.scn/.res) the previewer cannot load',
    category: 'validation',
    emits: armEmits(arms),
  },
  check: checkBinaryResourceReferences,
};

ruleRegistry.register(binaryResourceRule);

export { binaryResourceRule };
