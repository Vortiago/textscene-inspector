/**
 * Semantic rules for SubViewportContainer. One with no SubViewport child draws nothing, while several
 * are legal, since the draw stacks each in tree order. `get_configuration_warnings()`
 * (subviewport_container.cpp:269-288) warns on a `mouse_default_cursor_shape` other than `CURSOR_ARROW`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { hasChildOfType } from '../../../../linter/childType.js';
import { CURSOR_ARROW, CURSOR_MAX } from '../../../../godot/control.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { armEmits, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  noViewport: {
    severity: 'warning',
    ruleName: 'subviewportcontainer-no-viewport',
    grounding: { kind: 'configuration-warning' },
  },
  nonArrowCursor: {
    severity: 'warning',
    ruleName: 'subviewportcontainer-non-arrow-cursor',
    grounding: { kind: 'configuration-warning' },
  },
} as const satisfies RuleArms<string>;

function checkSubViewportContainer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // `cast_to<SubViewport>` (subviewport_container.cpp:274), so a subclass counts, and a
  // child whose class lives elsewhere may be one (instance-opaque linting, CONTEXT.md).
  if (!hasChildOfType(node, ['SubViewport'])) {
    reportArm(
      diagnostics,
      arms.noViewport,
      node,
      "SubViewportContainer has no SubViewport child, so it displays nothing. Add a SubViewport beneath it, or use a plain Container."
    );
  }

  const props = isValidProperties(node.properties) ? node.properties : {};
  // `mouse_default_cursor_shape` starts at `CURSOR_ARROW` (0) (control.h:245), so an absent key
  // never warns.
  const cursorRaw = props.mouse_default_cursor_shape;
  if (cursorRaw !== undefined) {
    // In range, not merely non-null: a non-finite reads as NaN and `99` reads
    // as 99, and neither is a CursorShape. Out of range is Control's `enforced:`
    // validator's error (control.cpp:2877); a second diagnostic here would
    // double-report it.
    const cursor = ruleInt(cursorRaw);
    const isShape = cursor !== null && cursor >= 0 && cursor < CURSOR_MAX;
    if (isShape && cursor !== CURSOR_ARROW) {
      reportArm(
        diagnostics,
        arms.nonArrowCursor,
        node,
        `SubViewportContainer '${node.name}' sets 'mouse_default_cursor_shape' away from Arrow, but it has no effect on this node. Consider leaving it at its initial value.`
      );
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
    emits: armEmits(arms),
  },
  check: checkSubViewportContainer,
};

ruleRegistry.register(subViewportContainerRule);

export { subViewportContainerRule };
