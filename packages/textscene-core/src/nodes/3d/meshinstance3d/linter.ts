/**
 * Semantic linter rules for MeshInstance3D
 *
 * Note: Format validation (cast_shadow values, transform format, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { MeshInstance3DProperties } from './types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';
import { extractNodePath, resolveNodePathTarget } from '../../../linter/linterUtils.js';

/**
 * Check if properties are valid MeshInstance3D properties
 */
function isMeshInstance3DProperties(props: unknown): props is MeshInstance3DProperties {
  return typeof props === 'object' && props !== null;
}

/**
 * Validate MeshInstance3D semantic rules (resource references, etc.)
 */
function checkMeshInstance3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Type guard for properties
  if (!isMeshInstance3DProperties(node.properties)) {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if mesh resource exists (if specified)
  if (rawProps.mesh) {
    const resourceExists = checkResourceExists(scene, rawProps.mesh);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Mesh resource not found: ${rawProps.mesh}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if material_override resource exists (if specified)
  if (rawProps.material_override) {
    const resourceExists = checkResourceExists(scene, rawProps.material_override);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Material override resource not found: ${rawProps.material_override}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if material_overlay resource exists (if specified)
  if (rawProps.material_overlay) {
    const resourceExists = checkResourceExists(scene, rawProps.material_overlay);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Material overlay resource not found: ${rawProps.material_overlay}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if skin resource exists (if specified)
  if (rawProps.skin) {
    const resourceExists = checkResourceExists(scene, rawProps.skin);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Skin resource not found: ${rawProps.skin}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check that each surface material override resource exists. The index gets no
  // bound: mesh_instance_3d.cpp:367 guards it with
  // ERR_FAIL_INDEX(p_surface, surface_override_materials.size()), so the ceiling
  // is the mesh's own surface count, which is not knowable from the .tscn.
  for (const [key, value] of Object.entries(rawProps)) {
    const match = key.match(/^surface_material_override\/(\d+)$/);
    if (match) {
      const surfaceIndex = parseInt(match[1]!, 10);

      // Check if resource exists
      const resourceExists = checkResourceExists(scene, value);
      if (!resourceExists) {
        diagnostics.push({
          severity: 'error',
          message: `Surface material override resource not found for surface ${surfaceIndex}: ${value}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-meshinstance3d-resources',
        });
      }
    }
  }

  // Validate visibility range logical consistency
  if (rawProps.visibility_range_begin !== undefined && rawProps.visibility_range_end !== undefined) {
    const rangeBegin = parseFloat(rawProps.visibility_range_begin);
    const rangeEnd = parseFloat(rawProps.visibility_range_end);
    if (!isNaN(rangeBegin) && !isNaN(rangeEnd) && rangeBegin > rangeEnd) {
      diagnostics.push({
        severity: 'error',
        message: `Invalid visibility range: begin (${rangeBegin}) must be less than or equal to end (${rangeEnd})`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-visibility-range',
      });
    }
  }

  // skeleton must reference an existing Skeleton3D node; empty/non-NodePath
  // means "no skeleton". resolveNodePathTarget suppresses escapes/ambiguous
  // paths (see its JSDoc).
  if (rawProps.skeleton) {
    const skeletonPath = extractNodePath(rawProps.skeleton);
    if (skeletonPath) {
      const target = resolveNodePathTarget(scene.nodes, node, skeletonPath);

      if (target.status === 'missing') {
        diagnostics.push({
          severity: 'error',
          message: `Skeleton node not found: NodePath("${skeletonPath}")`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-meshinstance3d-skeleton',
        });
      } else if (target.status === 'found' && target.node.type !== 'Skeleton3D') {
        diagnostics.push({
          severity: 'error',
          message: `Skeleton property points to a ${target.node.type} node, but must point to a Skeleton3D node`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-meshinstance3d-skeleton',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * MeshInstance3D semantic validation rule
 */
const meshInstance3DValidationRule: LintRule = {
  meta: {
    name: 'valid-meshinstance3d-resources',
    description: 'Validates MeshInstance3D resource references, skeleton paths, and visibility ranges',
    category: 'validation',
    // Matcher, not a name list: RuleRegistry matches applicableNodeTypes by
    // exact name, so SoftBody3D — which inherits `mesh` from MeshInstance3D —
    // got no resource-existence check at all.
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'MeshInstance3D'),
    emits: [
      { ruleName: 'valid-meshinstance3d-resources', severity: 'error' },
      { ruleName: 'valid-meshinstance3d-visibility-range', severity: 'error' },
      { ruleName: 'valid-meshinstance3d-skeleton', severity: 'error' },
    ],
  },
  check: checkMeshInstance3D,
};

// Self-register the rule
ruleRegistry.register(meshInstance3DValidationRule);

// Export for testing
export { meshInstance3DValidationRule };
