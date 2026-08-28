/**
 * Semantic linter rules for Skeleton3D
 *
 * Validates property values and provides warnings for common issues.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { Skeleton3DProperties } from './types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { indexedKeyRegex, boolSlotValue} from '../../../godot/index.js';
import { boneNameFindings } from './boneNameOrder.js';

/**
 * `bones/<i>/pose` and `bones/<i>/bound_children`, the two 3.x arms
 * (skeleton_3d.cpp:107). Slice 2 alone reaches the arm (:83), so a segment
 * below the leaf still lands on it.
 */
const DEPRECATED_POSE_KEY = indexedKeyRegex(
  '^bones/#/(?:pose|bound_children)(?:/.*)?$',
  'to_int'
);

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

  // `motion_scale` is validated in linterParser.ts, both tiers of it.

  // Warning: show_rest_only = true (debugging mode, animations disabled)
  if (boolSlotValue(rawProps.show_rest_only) === true) {
    diagnostics.push({
      severity: 'warning',
      message: `show_rest_only is enabled. Skeleton is in debugging mode with bones forced to rest pose. Animations are disabled.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'skeleton3d-debug-mode',
    });
  }

  // Warning: animate_physical_bones = true (deprecated ragdoll feature)
  if (boolSlotValue(rawProps.animate_physical_bones) === true) {
    diagnostics.push({
      severity: 'warning',
      message: `animate_physical_bones is enabled. This is a deprecated feature for ragdoll physics. Consider using the new SkeletonModifier3D system instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'skeleton3d-deprecated-feature',
    });
  }

  // modifier_callback_mode_process values are valid modes — no diagnostic

  // skeleton_3d.cpp:108-110 fires WARN_DEPRECATED_MSG before recomputing the
  // pose. Once per node rather than once per key: the engine warns per write,
  // and a converted skeleton carries one for every bone.
  const deprecated = Object.keys(rawProps).filter((key) => DEPRECATED_POSE_KEY.test(key));
  if (deprecated.length > 0) {
    diagnostics.push({
      severity: 'warning',
      message: `${deprecated.length === 1 ? `'${deprecated[0]}' uses` : `${deprecated.length} bone keys such as '${deprecated[0]}' use`} the old 3.x pose format, which is deprecated and loads slower. Re-import or re-save the scene.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'skeleton3d-deprecated-bone-pose',
    });
  }

  for (const finding of boneNameFindings(rawProps)) {
    diagnostics.push(
      finding.kind === 'order'
        ? {
            severity: 'error',
            message: `'${finding.key}' names bone ${finding.index}, but only ${finding.expected} bone${finding.expected === 1 ? '' : 's'} exist${finding.expected === 1 ? 's' : ''} by this line. Godot adds a bone only when the index equals the current count, so it drops this write.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'skeleton3d-bone-name-order',
          }
        : {
            severity: 'error',
            message: `'${finding.key}' reuses the bone name "${finding.name}", already held by bone ${finding.heldBy}. Godot refuses a duplicate name and never adds this bone.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'skeleton3d-duplicate-bone-name',
          }
    );
  }

  return diagnostics;
}

/**
 * Skeleton3D semantic validation rule
 */
const skeleton3DValidationRule: LintRule = {
  meta: {
    name: 'valid-skeleton3d-usage',
    description: 'Validates Skeleton3D debug flags, deprecated features and bone-name writes',
    category: 'validation',
    applicableNodeTypes: ['Skeleton3D'],
    emits: [
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
      {
        ruleName: 'skeleton3d-deprecated-bone-pose',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'skeleton_3d.cpp:108' },
      },
      {
        ruleName: 'skeleton3d-bone-name-order',
        severity: 'error',
        grounding: { kind: 'engine', at: 'skeleton_3d.cpp:85' },
      },
      {
        ruleName: 'skeleton3d-duplicate-bone-name',
        severity: 'error',
        grounding: { kind: 'engine', at: 'skeleton_3d.cpp:606' },
      },
    ],
  },
  check: checkSkeleton3D,
};

// Self-register the rule
ruleRegistry.register(skeleton3DValidationRule);

// Export for testing
export { skeleton3DValidationRule };
