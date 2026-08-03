/**
 * Semantic linter rules for SubViewportContainer.
 *
 * The one condition worth flagging is structural: the container exists solely to
 * display its SubViewport children, so one with none draws nothing at all. No
 * format check can see that — it is a fact about the node's CHILDREN.
 *
 * Deliberately NOT a rule: more than one SubViewport child. Godot's
 * `NOTIFICATION_DRAW` loops every SubViewport child and draws each, stacked in
 * tree order, so multiple children are legal rather than suspicious.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';

function checkSubViewportContainer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const children = node.children ?? [];
  if (children.some((child) => child.type === 'SubViewport')) return diagnostics;

  // Instance-opaque linting (CONTEXT.md): an `instance=` child is a childless,
  // typeless node here, and the sub-scene it points at may well be rooted at a
  // SubViewport. Staying silent beats false-positiving on a normal Godot idiom.
  if (children.some((child) => child.instance)) return diagnostics;

  diagnostics.push({
    severity: 'warning',
    message:
      "SubViewportContainer has no SubViewport child, so it displays nothing. Add a SubViewport beneath it, or use a plain Container.",
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'subviewportcontainer-no-viewport',
  });
  return diagnostics;
}

const subViewportContainerRule: LintRule = {
  meta: {
    name: 'valid-subviewportcontainer-children',
    description:
      'Flags a SubViewportContainer with no SubViewport child, which renders an empty surface',
    category: 'validation',
    applicableNodeTypes: ['SubViewportContainer'],
    emits: [{ ruleName: 'subviewportcontainer-no-viewport', severity: 'warning' }],
  },
  check: checkSubViewportContainer,
};

ruleRegistry.register(subViewportContainerRule);

export { subViewportContainerRule };
