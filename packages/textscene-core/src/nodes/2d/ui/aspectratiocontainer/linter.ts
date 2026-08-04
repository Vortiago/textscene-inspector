/**
 * Semantic linter rules for AspectRatioContainer.
 *
 * Format validation is in linterParser.ts. This file covers the one
 * scene-context condition Godot's own sort pass emits a real runtime warning
 * for: `NOTIFICATION_SORT_CHILDREN` (aspect_ratio_container.cpp:109-115) skips
 * positioning a direct TextureRect child whose expand_mode is
 * EXPAND_FIT_WIDTH_PROPORTIONAL (3) or EXPAND_FIT_HEIGHT_PROPORTIONAL (5),
 * calling `WARN_PRINT_ONCE("Proportional TextureRect is currently not
 * supported inside AspectRatioContainer")` and leaving it unpositioned. Only
 * a DIRECT child is checked, matching the engine's own `get_child(i)` scan.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';

// texture_rect.h:39-45 TextureRect::ExpandMode: EXPAND_KEEP_SIZE=0,
// EXPAND_IGNORE_SIZE=1, EXPAND_FIT_WIDTH=2, EXPAND_FIT_WIDTH_PROPORTIONAL=3,
// EXPAND_FIT_HEIGHT=4, EXPAND_FIT_HEIGHT_PROPORTIONAL=5.
const UNSUPPORTED_EXPAND_MODES = new Set([3, 5]);

function checkAspectRatioContainer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  for (const child of node.children) {
    if (child.type !== 'TextureRect') continue;
    if (!isValidProperties(child.properties)) continue;

    const raw = child.properties.expand_mode;
    if (raw === undefined) continue;
    const expandMode = Number(raw);
    if (!UNSUPPORTED_EXPAND_MODES.has(expandMode)) continue;

    diagnostics.push({
      severity: 'warning',
      message: `TextureRect '${child.name}' has expand_mode ${expandMode}, a proportional mode AspectRatioContainer does not support: Godot's own sort skips positioning it ("Proportional TextureRect is currently not supported inside AspectRatioContainer"). Use a non-proportional expand_mode or a plain Container.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'aspectratiocontainer-unsupported-texturerect-expand-mode',
    });
  }

  return diagnostics;
}

const aspectRatioContainerRule: LintRule = {
  meta: {
    name: 'valid-aspectratiocontainer-children',
    description:
      'Flags a direct TextureRect child whose proportional expand_mode AspectRatioContainer skips positioning at runtime',
    category: 'validation',
    applicableNodeTypes: ['AspectRatioContainer'],
    emits: [
      { ruleName: 'aspectratiocontainer-unsupported-texturerect-expand-mode', severity: 'warning' },
    ],
  },
  check: checkAspectRatioContainer,
};

ruleRegistry.register(aspectRatioContainerRule);

export { aspectRatioContainerRule };
