/**
 * Semantic linter rules for Skeleton3D
 *
 * Validates property values and provides warnings for common issues.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { Skeleton3DProperties } from './types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

/**
 * Check if properties are valid Skeleton3D properties
 */
function isSkeleton3DProperties(props: unknown): props is Skeleton3DProperties {
  return typeof props === 'object' && props !== null;
}

/**
 * Validate Skeleton3D semantic rules
 */
function checkSkeleton3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;


  // Type guard for properties
  if (!isSkeleton3DProperties(node.properties)) {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Only the value the setter actually refuses. The hint is "0.001,10,0.001,
  // or_greater" (skeleton_3d.cpp:1293), so an open max end makes a large scale
  // legal, and anything down to 0.001 sits inside the hint's own range.
  if (rawProps.motion_scale !== undefined) {
    const motionScale = parseFloat(rawProps.motion_scale);
    if (!isNaN(motionScale) && motionScale <= 0) {
      diagnostics.push({
        severity: 'error',
        message: `motion_scale is ${motionScale}. Godot replaces it with 1.0, so the authored value never applies.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-skeleton3d-motion-scale',
      });
    }
  }

  // Warning: show_rest_only = true (debugging mode, animations disabled)
  if (rawProps.show_rest_only === 'true') {
    diagnostics.push({
      severity: 'warning',
      message: `show_rest_only is enabled. Skeleton is in debugging mode with bones forced to rest pose. Animations are disabled.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'skeleton3d-debug-mode',
    });
  }

  // Warning: animate_physical_bones = true (deprecated ragdoll feature)
  if (rawProps.animate_physical_bones === 'true') {
    diagnostics.push({
      severity: 'warning',
      message: `animate_physical_bones is enabled. This is a deprecated feature for ragdoll physics. Consider using the new SkeletonModifier3D system instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'skeleton3d-deprecated-feature',
    });
  }

  // modifier_callback_mode_process values are valid modes — no diagnostic

  return diagnostics;
}

/**
 * Skeleton3D semantic validation rule
 */
const skeleton3DValidationRule: LintRule = {
  meta: {
    name: 'valid-skeleton3d-usage',
    description: 'Validates Skeleton3D motion_scale values and debug modes',
    category: 'validation',
    applicableNodeTypes: ['Skeleton3D'],
    emits: [
      {
        ruleName: 'valid-skeleton3d-motion-scale',
        severity: 'error',
        grounding: { kind: 'engine', at: 'skeleton_3d.cpp:586' },
      },
      {
        ruleName: 'skeleton3d-debug-mode',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'skeleton_3d.cpp:551',
          unused: 'show_rest_only disables every bone, so no authored pose is applied',
        },
      },
      {
        ruleName: 'skeleton3d-deprecated-feature',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'skeleton_3d.cpp:71' },
      },
    ],
  },
  check: checkSkeleton3D,
};

// Self-register the rule
ruleRegistry.register(skeleton3DValidationRule);

// Export for testing
export { skeleton3DValidationRule };
