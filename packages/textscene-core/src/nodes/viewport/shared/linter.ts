/**
 * Semantic linter rule shared by every Viewport-derived node — SubViewport
 * and the whole Window family — for Godot's own configuration warning,
 * `Viewport::get_configuration_warnings()` (viewport.cpp:3706-3714):
 *
 *     PackedStringArray warnings = Node::get_configuration_warnings();
 *     if (size.x <= 1 || size.y <= 1) {
 *         warnings.push_back(RTR("The Viewport size must be greater than or
 *             equal to 2 pixels on both dimensions to render anything."));
 *     }
 *     return warnings;
 *
 * `Window` does not override `get_configuration_warnings()`, so this same
 * check reaches it and its whole subtree (AcceptDialog, ConfirmationDialog,
 * FileDialog, Popup, PopupMenu, PopupPanel, ScriptCreateDialog) as well as
 * `SubViewport` — both branches serialise their own `size` under the same
 * property name (viewport.cpp:5579, window.cpp:3429), which is why one shared
 * rule under the abstract `'Viewport'` key covers both, the same shape
 * `viewport/shared/linterParser.ts` uses for this tier's format validators.
 *
 * SubViewport is EXCLUDED from the diagnostic (though still reached by the
 * matcher, see below): its own `size` validator already floors both
 * components at 2 (`nodes/viewport/subviewport/linterParser.ts`,
 * `v.vector2i('size', { min: 2, enforced: 'viewport.cpp:1120' })`, from
 * `SubViewport::_internal_set_size` -> `Viewport::_set_size`'s
 * `Size2i new_size = p_size.maxi(2)`). For an integer vector, "a component
 * < 2" and "a component <= 1" are the SAME set of raw values, so every scene
 * this warning would flag on a SubViewport already fails as an ERROR at the
 * same threshold — reporting it again here at warning tier would repeat one
 * defect twice rather than name a second one (the `LineEdit.secret_character`
 * precedent in configurationWarningCoverage.test.ts). Window's own `size`
 * validator floors only at 0 (`min_size` defaults to (0, 0)), so `size =
 * Vector2i(1, 1)` genuinely survives Window's setter — that branch is the
 * live, uncovered gap this rule exists for.
 *
 * The matcher stays `descendsFrom(t, 'Viewport')` (not narrowed to `'Window'`)
 * so the rule is WIRED to every one of the 9 concrete Viewport descendants,
 * matching the row's own reach claim; only the check body's early return
 * keeps SubViewport silent.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { VECTOR2I_REGEX } from '../../../linter/validators/index.js';
import { intComponent } from '../../../linter/validators/commonValidators.js';

function checkViewportSize(context: RuleContext): Diagnostic[] {
  const { node } = context;

  // SubViewport's own size validator already floors at 2 component-wise, an
  // error-tier defect for the same raw values — see the module docblock.
  if (!descendsFrom(node.type, 'Window')) return [];

  const props = isValidProperties(node.properties) ? node.properties : {};
  const raw = props.size;
  if (raw === undefined) return [];

  const match = VECTOR2I_REGEX.exec(raw);
  if (!match) return [];
  const x = intComponent(match[1]);
  const y = intComponent(match[2]);
  // A component no int32 holds is the validator's error, not a size to name.
  if (x === null || y === null) return [];
  if (x > 1 && y > 1) return [];

  return [
    {
      severity: 'warning',
      message: `${node.type} '${node.name}' has 'size = Vector2i(${x}, ${y})'. The size must be at least 2 pixels on both dimensions to render anything.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'viewport-size-too-small',
    },
  ];
}

const viewportSizeRule: LintRule = {
  meta: {
    name: 'valid-viewport-size',
    description:
      'Flags a Window-family node whose size is 1 pixel or smaller on either axis, so it renders nothing',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Viewport'),
    emits: [{ ruleName: 'viewport-size-too-small', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkViewportSize,
};

ruleRegistry.register(viewportSizeRule);

export { viewportSizeRule };
