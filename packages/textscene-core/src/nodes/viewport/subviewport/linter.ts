/**
 * Semantic linter rules for SubViewport.
 *
 * Format checks live in linterParser.ts and are errors. This file is the home
 * for advisory conditions, which are ALWAYS warnings — a committed positive
 * fixture may legally carry one, and an error rule here would break fixtureLint.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';

const VECTOR2I = /^Vector2i\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;

function checkSubViewport(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (node.type !== 'SubViewport') return diagnostics;
  if (!isValidProperties(node.properties)) return diagnostics;

  const props = node.properties as Record<string, string>;

  // An ABSENT size is fine — Godot defaults it to 512x512. Only an explicitly
  // authored zero/degenerate size is worth flagging.
  const raw = props.size;
  if (raw !== undefined) {
    const match = VECTOR2I.exec(raw);
    if (match) {
      const x = Number(match[1]);
      const y = Number(match[2]);
      if (x <= 0 || y <= 0) {
        diagnostics.push({
          severity: 'warning',
          message: `SubViewport 'size' is ${raw}: a viewport with a zero-area target renders nothing, and anything displaying it shows an empty surface.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'subviewport-empty-size',
        });
      }
    }
  }

  return diagnostics;
}

const subViewportRule: LintRule = {
  meta: {
    name: 'valid-subviewport-properties',
    description:
      'Flags SubViewport configurations that parse cleanly but cannot produce a visible render target',
    category: 'validation',
    applicableNodeTypes: ['SubViewport'],
    emits: [{ ruleName: 'subviewport-empty-size', severity: 'warning' }],
  },
  check: checkSubViewport,
};

ruleRegistry.register(subViewportRule);

export { subViewportRule };
