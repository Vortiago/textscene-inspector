/**
 * Node-universal semantic rule (no applicableNodeTypes, so it runs for every node): a reference to
 * a binary Godot resource (`.scn`, `.res`) is marked "not previewable", since the previewer loads
 * only text formats (`.tscn`, `.tres`) and the content degrades to a missing-resource placeholder.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../linter/types.js';
import { ruleRegistry } from '../../linter/RuleRegistry.js';
import { resourceRef } from '../../godot/index.js';

const BINARY_RESOURCE_RE = /\.(scn|res)$/i;

function checkBinaryResourceReferences(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  const flag = (property: string, path: string) => {
    diagnostics.push({
      severity: 'info',
      message:
        `'${property}' references a binary Godot resource (${path}) — ` +
        `the previewer only loads text resources (.tscn/.tres), so this content shows as missing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'binary-resource-reference',
    });
  };

  const pathForRef = (ref: string): string | null => {
    const parsed = resourceRef(ref);
    if (parsed?.kind !== 'ExtResource') return null;
    const ext = scene.externalResources.find((r) => r.id === parsed.id);
    return ext && BINARY_RESOURCE_RE.test(ext.path) ? ext.path : null;
  };

  if (node.instance) {
    const path = pathForRef(node.instance);
    if (path) flag('instance', path);
  }
  for (const [key, value] of Object.entries(node.properties as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
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
    emits: [
      {
        ruleName: 'binary-resource-reference',
        severity: 'info',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'previewer-limitation',
          because: 'this previewer decodes only text .tscn/.tres, never a binary .scn/.res payload',
        },
      },
    ],
  },
  check: checkBinaryResourceReferences,
};

ruleRegistry.register(binaryResourceRule);

export { binaryResourceRule };
