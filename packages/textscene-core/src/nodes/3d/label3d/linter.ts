/**
 * Semantic linter rules for Label3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., unusual sizes).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';

/**
 * `pixel_size` hint, label_3d.cpp:131 — PROPERTY_HINT_RANGE
 * "0.0001,128,0.0001,suffix:m". Neither end is open and `set_pixel_size` (:954)
 * only compares before assigning, so both ends are advisory.
 */
const PIXEL_SIZE_HINT_MIN = 0.0001;
const PIXEL_SIZE_HINT_MAX = 128;

/**
 * Validate Label3D semantic rules
 */
function checkLabel3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  // Range advisory: pixel_size outside the range the inspector offers.
  return rangeAdvisories(node, {
    pixel_size: [
      {
        under: PIXEL_SIZE_HINT_MIN,
        ruleName: 'label3d-small-pixel-size',
        cite: 'label_3d.cpp:131',
        message: (pixelSize) =>
          `Label3D pixel_size is ${pixelSize}. The editor range starts at ${PIXEL_SIZE_HINT_MIN}.`,
      },
      {
        over: PIXEL_SIZE_HINT_MAX,
        ruleName: 'label3d-large-pixel-size',
        cite: 'label_3d.cpp:131',
        message: (pixelSize) =>
          `Label3D pixel_size is ${pixelSize}. The editor range stops at ${PIXEL_SIZE_HINT_MAX}.`,
      },
    ],
  });
}

/**
 * Label3D semantic validation rule
 */
const label3DValidationRule: LintRule = {
  meta: {
    name: 'valid-label3d-properties',
    description: 'Validates Label3D property values and warns about unusual sizes',
    category: 'validation',
    emits: [
      {
        ruleName: 'label3d-small-pixel-size',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'label_3d.cpp:131' },
      },
      {
        ruleName: 'label3d-large-pixel-size',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'label_3d.cpp:131' },
      },
    ],
    applicableNodeTypes: ['Label3D'],
  },
  check: checkLabel3D,
};

// Self-register the rule
ruleRegistry.register(label3DValidationRule);

// Export for testing
export { label3DValidationRule };
