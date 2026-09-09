/**
 * Semantic linter rules for SubViewportContainer.
 *
 * 1. The structural check: the container exists solely to display its
 * SubViewport children, so one with none draws nothing at all. No format
 * check can see that — it is a fact about the node's CHILDREN.
 *
 * Deliberately NOT a rule: more than one SubViewport child. Godot's
 * `NOTIFICATION_DRAW` loops every SubViewport child and draws each, stacked in
 * tree order, so multiple children are legal rather than suspicious.
 *
 * 2. `SubViewportContainer::get_configuration_warnings()`
 * (subviewport_container.cpp:269-288) also checks:
 *
 *     if (get_default_cursor_shape() != Control::CURSOR_ARROW) {
 *         warnings.push_back(RTR("The default mouse cursor shape of
 *             SubViewportContainer has no effect.\nConsider leaving it at its
 *             initial value `CURSOR_ARROW`."));
 *     }
 *
 * `mouse_default_cursor_shape` field-initialises to `CURSOR_ARROW` (0)
 * (control.h:245), so an absent key means ARROW and never warns.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { isTypeUnknowable } from '../../../../linter/parentType.js';
import { descendsFrom, isCatalogedType } from '../../../../godot/nodeBaseTypes.js';
import { CURSOR_ARROW, CURSOR_MAX } from '../../../../godot/control.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';

function checkSubViewportContainer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const children = node.children ?? [];
  // `cast_to<SubViewport>` (subviewport_container.cpp:274), so a subclass
  // counts; `descendsFrom` is reflexive and still matches a plain SubViewport.
  const hasSubViewport = children.some((child) => descendsFrom(child.type, 'SubViewport'));
  // Instance-opaque linting (CONTEXT.md): a child whose type comes from another
  // scene may well be rooted at a SubViewport, so staying silent beats
  // false-positiving on a normal Godot idiom. Testing `instance` alone missed
  // the override-heading case, which parses as a confident `'Node'`; a class
  // outside Godot's catalog is the same question, since `descendsFrom` answers
  // false for "never heard of it" exactly as it does for "not a subclass".
  const hasOpaqueChild = children.some(
    (child) => isTypeUnknowable(child) || !isCatalogedType(child.type)
  );

  if (!hasSubViewport && !hasOpaqueChild) {
    diagnostics.push({
      severity: 'warning',
      message:
        "SubViewportContainer has no SubViewport child, so it displays nothing. Add a SubViewport beneath it, or use a plain Container.",
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'subviewportcontainer-no-viewport',
    });
  }

  const props = isValidProperties(node.properties) ? node.properties : {};
  const cursorRaw = props.mouse_default_cursor_shape;
  if (cursorRaw !== undefined) {
    // In range, not merely non-null: a non-finite reads as NaN and `99` reads
    // as 99, and neither is a CursorShape. Out of range is Control's `enforced:`
    // validator's error (control.cpp:2877); a second diagnostic here would
    // double-report it.
    const cursor = ruleInt(cursorRaw);
    const isShape = cursor !== null && cursor >= 0 && cursor < CURSOR_MAX;
    if (isShape && cursor !== CURSOR_ARROW) {
      diagnostics.push({
        severity: 'warning',
        message: `SubViewportContainer '${node.name}' sets 'mouse_default_cursor_shape' away from Arrow, but it has no effect on this node. Consider leaving it at its initial value.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'subviewportcontainer-non-arrow-cursor',
      });
    }
  }

  return diagnostics;
}

const subViewportContainerRule: LintRule = {
  meta: {
    name: 'valid-subviewportcontainer-children',
    description:
      'Flags a SubViewportContainer with no SubViewport child, or a mouse_default_cursor_shape override that has no effect',
    category: 'validation',
    applicableNodeTypes: ['SubViewportContainer'],
    emits: [
      { ruleName: 'subviewportcontainer-no-viewport', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'subviewportcontainer-non-arrow-cursor', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkSubViewportContainer,
};

ruleRegistry.register(subViewportContainerRule);

export { subViewportContainerRule };
