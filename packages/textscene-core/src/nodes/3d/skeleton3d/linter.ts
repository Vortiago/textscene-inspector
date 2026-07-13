/**
 * Semantic linter rules for Skeleton3D
 *
 * Validates usage context and provides warnings for common issues.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { Skeleton3DProperties } from './types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

const MOTION_SCALE_MIN_WARN = 0.1;
const MOTION_SCALE_MAX_WARN = 10.0;

/**
 * Check if properties are valid Skeleton3D properties
 */
function isSkeleton3DProperties(props: unknown): props is Skeleton3DProperties {
  return typeof props === 'object' && props !== null;
}

/**
 * Recursively find all nodes of a specific type in the scene tree
 */
function findNodesByType(nodes: TscnNode[], nodeType: string): TscnNode[] {
  const results: TscnNode[] = [];
  for (const node of nodes) {
    if (node.type === nodeType) {
      results.push(node);
    }
    results.push(...findNodesByType(node.children, nodeType));
  }
  return results;
}

/**
 * Check if any MeshInstance3D node references this Skeleton3D
 */
function isSkeletonUsedByMesh(
  skeletonName: string,
  meshNodes: TscnNode[]
): boolean {
  for (const meshNode of meshNodes) {
    // Properties can be a typed object or a plain Record
    const rawProps = meshNode.properties as Record<string, unknown>;

    // Check if skeleton property exists (as string)
    const skeletonProp = rawProps.skeleton;
    if (typeof skeletonProp === 'string') {
      // Extract skeleton path from NodePath("...")
      const match = skeletonProp.match(/^NodePath\("([^"]*)"\)$/);
      if (match && match[1] !== undefined) {
        const skeletonPath = match[1];

        // Empty path means no skeleton
        if (skeletonPath === '') {
          continue;
        }

        // Check if the path references this skeleton
        // Path can be relative (e.g., "../Skeleton") or just the name
        const pathParts = skeletonPath.split('/');
        const referencedName = pathParts[pathParts.length - 1];
        if (referencedName === skeletonName) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Validate Skeleton3D semantic rules
 */
function checkSkeleton3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for Skeleton3D nodes
  if (node.type !== 'Skeleton3D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isSkeleton3DProperties(node.properties)) {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // WARNING: motion_scale = 0 (animations won't apply)
  if (rawProps.motion_scale !== undefined) {
    const motionScale = parseFloat(rawProps.motion_scale);
    if (!isNaN(motionScale)) {
      if (motionScale === 0) {
        diagnostics.push({
          severity: 'warning',
          message: `motion_scale is set to 0. Animations will not be applied. Set to 1.0 for normal animation speed.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-skeleton3d-motion-scale',
        });
      } else if (motionScale < MOTION_SCALE_MIN_WARN) {
        diagnostics.push({
          severity: 'warning',
          message: `motion_scale is very small (${motionScale}). This may result in extremely slow animations. Consider using a value >= ${MOTION_SCALE_MIN_WARN}.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-skeleton3d-motion-scale',
        });
      } else if (motionScale > MOTION_SCALE_MAX_WARN) {
        diagnostics.push({
          severity: 'warning',
          message: `motion_scale is very large (${motionScale}). This may result in extremely fast animations. Consider using a value <= ${MOTION_SCALE_MAX_WARN}.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-skeleton3d-motion-scale',
        });
      }
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

  // WARNING: Skeleton3D without MeshInstance3D children using it (unused skeleton)
  // Find all MeshInstance3D nodes in the scene
  const meshNodes = findNodesByType(scene.nodes, 'MeshInstance3D');
  const isUsed = isSkeletonUsedByMesh(node.name, meshNodes);

  // Warn if skeleton is not referenced by any MeshInstance3D
  // Note: We warn even if there are no MeshInstance3D nodes, as the skeleton might be unused
  if (!isUsed && meshNodes.length > 0) {
    diagnostics.push({
      severity: 'warning',
      message: `Skeleton3D "${node.name}" is not referenced by any MeshInstance3D nodes. The skeleton may be unused. MeshInstance3D nodes should have a 'skeleton' property pointing to this skeleton.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'skeleton3d-unused',
    });
  }

  return diagnostics;
}

/**
 * Skeleton3D semantic validation rule
 */
const skeleton3DValidationRule: LintRule = {
  meta: {
    name: 'valid-skeleton3d-usage',
    description: 'Validates Skeleton3D motion_scale values, debug modes, and usage patterns',
    category: 'validation',
    applicableNodeTypes: ['Skeleton3D'],
  },
  check: checkSkeleton3D,
};

// Self-register the rule
ruleRegistry.register(skeleton3DValidationRule);

// Export for testing
export { skeleton3DValidationRule };
