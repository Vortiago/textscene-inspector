/**
 * Window's cross-field rule: a `max_size` below `min_size` on any axis. Godot drops
 * such a max without an error (doc/classes/Window.xml, scene/main/window.cpp's
 * `_validate_limit_size`), so the rule is advisory. Format checks live in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { matchVector2i } from '../../../linter/validators/index.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';

function checkWindow(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  if (rawProps.max_size === undefined || rawProps.min_size === undefined) {
    return diagnostics;
  }

  const maxSize = matchVector2i(rawProps.max_size);
  const minSize = matchVector2i(rawProps.min_size);
  if (!maxSize || !minSize) return diagnostics;

  // `_clamp_limit_size` (:461) floors a negative component at 0, so `!== 0` agrees
  // with Godot's `> 0` in `_validate_limit_size` (scene/main/window.cpp:473).
  const maxSizeSet = maxSize.x !== 0 || maxSize.y !== 0;
  // One failing axis invalidates the whole max_size, and Godot uses the rendering
  // server's maximum: `Vector2i(0, 1080)` under `Vector2i(400, 300)` has no maximum at
  // all, not a capped height. So this checks each component.
  if (maxSizeSet && (maxSize.x < minSize.x || maxSize.y < minSize.y)) {
    diagnostics.push({
      severity: 'info',
      message: `Window 'max_size' (Vector2i(${maxSize.x}, ${maxSize.y})) is smaller than 'min_size' (Vector2i(${minSize.x}, ${minSize.y})) in at least one dimension. Godot ignores max_size entirely in this case.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'window-max-size-below-min-size',
    });
  }

  return diagnostics;
}

const windowValidationRule: LintRule = {
  meta: {
    name: 'valid-window-properties',
    description: "Validates Window's max_size/min_size consistency",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Window'),
    emits: [
      {
        ruleName: 'window-max-size-below-min-size',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'window.cpp:473',
          unused: 'the size fails this validity test, so the rendering server maximum is used instead',
        },
      },
    ],
  },
  check: checkWindow,
};

ruleRegistry.register(windowValidationRule);

export { windowValidationRule };
