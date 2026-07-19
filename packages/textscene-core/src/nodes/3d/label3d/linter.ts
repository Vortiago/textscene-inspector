/**
 * Semantic linter rules for Label3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., empty text, unusual sizes).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';

// Thresholds for warnings
const MAX_NORMAL_PIXEL_SIZE = 1.0;

/**
 * Validate Label3D semantic rules
 */
function checkLabel3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Only run for Label3D nodes
  if (node.type !== 'Label3D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // WARN: Empty text
  if (rawProps.text !== undefined) {
    const text = rawProps.text.replace(/^"(.*)"$/, '$1'); // Remove quotes
    if (text === '') {
      diagnostics.push({
        severity: 'warning',
        message: `Label3D has empty text. The label will not display any content.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'label3d-empty-text',
      });
    }
  }

  // Range advisory: very large pixel_size (likely unintentional).
  diagnostics.push(
    ...rangeAdvisories(node, {
      pixel_size: [
        {
          over: MAX_NORMAL_PIXEL_SIZE,
          ruleName: 'label3d-large-pixel-size',
          message: (pixelSize) =>
            `Label3D pixel_size is very large (${pixelSize}). Values above ${MAX_NORMAL_PIXEL_SIZE} may create unexpectedly large text in the scene.`,
        },
      ],
    })
  );

  return diagnostics;
}

/**
 * Label3D semantic validation rule
 */
const label3DValidationRule: LintRule = {
  meta: {
    name: 'valid-label3d-properties',
    description: 'Validates Label3D property values and warns about empty text or unusual sizes',
    category: 'validation',
    applicableNodeTypes: ['Label3D'],
  },
  check: checkLabel3D,
};

// Self-register the rule
ruleRegistry.register(label3DValidationRule);

// Export for testing
export { label3DValidationRule };
