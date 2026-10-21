/**
 * Node-universal semantic rule (no applicableNodeTypes, so it runs for every node): a reference to
 * a binary Godot scene is marked "not previewable", since the previewer loads only text scenes
 * (`.tscn`) and the content degrades to a missing-resource placeholder. It reads any other `.res`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../linter/types.js';
import { ruleRegistry } from '../../linter/RuleRegistry.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../linter/ruleArms.js';
import { resourceRef } from '../../godot/variant/resourceRef.js';
import { findExtResource } from '../../resources/SubResourceResolver.js';
import type { TscnExternalResource } from '../../parser/types.js';

/**
 * Godot saves a PackedScene as a `.scn`, or as a `.res` on request
 * (`resource_format_binary.cpp:2541-2545`).
 */
const BINARY_SCENE_RE = /\.scn$/i;
const BINARY_RESOURCE_RE = /\.res$/i;

/** One arm, so the rule reports `<unknown>` for a heading with no type, as every other rule does. */
const arms = {
  binaryReference: groundedArm('binary-resource-reference', {
    kind: 'no-engine-counterpart',
    scope: 'previewer-limitation',
    because: 'this previewer decodes only a text .tscn scene, never a binary .scn or .res one',
  }),
} as const satisfies RuleArms<string>;

function isBinaryScene({ path, type }: TscnExternalResource): boolean {
  return BINARY_SCENE_RE.test(path) || (type === 'PackedScene' && BINARY_RESOURCE_RE.test(path));
}

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

  const pathForRef = (ref: string): string | null => {
    const parsed = resourceRef(ref);
    if (parsed?.kind !== 'ExtResource') return null;
    const ext = findExtResource(scene.externalResources, parsed.id);
    return ext && isBinaryScene(ext) ? ext.path : null;
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
    description: 'Flags references to binary Godot scenes (.scn, .res) the previewer cannot load',
    category: 'validation',
    emits: armEmits(arms),
  },
  check: checkBinaryResourceReferences,
};

ruleRegistry.register(binaryResourceRule);
