/**
 * Semantic linter rules for Window.
 *
 * Format validation is handled by linterParser.ts. This file holds the one
 * genuine cross-field check: doc/classes/Window.xml's `max_size` entry notes
 * "This property will be ignored if the value is lower than min_size" — and
 * scene/main/window.cpp's `_validate_limit_size` confirms it component-wise
 * (`max_size.x >= min_size.x && max_size.y >= min_size.y`, gated on max_size
 * being non-zero). A scene author who sets a `max_size` smaller than `min_size`
 * gets no error from Godot — the max is silently dropped — so this is a
 * warning, not an error.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { VECTOR2I_REGEX } from '../../../linter/validators/index.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';

function parseVector2i(raw: string): { x: number; y: number } | null {
  const match = VECTOR2I_REGEX.exec(raw);
  if (!match) return null;
  return { x: parseInt(match[1]!, 10), y: parseInt(match[2]!, 10) };
}

function checkWindow(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  if (!descendsFrom(node.type, 'Window')) return diagnostics;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  if (rawProps.max_size === undefined || rawProps.min_size === undefined) {
    return diagnostics;
  }

  const maxSize = parseVector2i(rawProps.max_size);
  const minSize = parseVector2i(rawProps.min_size);
  if (!maxSize || !minSize) return diagnostics;

  // scene/main/window.cpp:473, Window::_validate_limit_size():
  //   bool max_size_valid = (max_size.x > 0 || max_size.y > 0) &&
  //       max_size.x >= min_size.x && max_size.y >= min_size.y;
  //   max_size_used = max_size_valid ? max_size : RS::…->get_maximum_viewport_size();
  //
  // Both halves matter, and the second is why this warns per component rather
  // than only when BOTH are undersized: a single failing axis makes the whole
  // max_size invalid, and Godot then discards it for the rendering server's
  // maximum — so `max_size = Vector2i(0, 1080)` under `min_size = Vector2i(400, 300)`
  // is not "unbounded width, capped height", it is no maximum at all.
  // Negative components cannot reach here: `_clamp_limit_size` (:461) floors
  // them at 0, which is why `!== 0` and Godot's `> 0` agree.
  const maxSizeSet = maxSize.x !== 0 || maxSize.y !== 0;
  if (maxSizeSet && (maxSize.x < minSize.x || maxSize.y < minSize.y)) {
    diagnostics.push({
      severity: 'warning',
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
    emits: [{ ruleName: 'window-max-size-below-min-size', severity: 'warning' }],
  },
  check: checkWindow,
};

ruleRegistry.register(windowValidationRule);

export { windowValidationRule };
