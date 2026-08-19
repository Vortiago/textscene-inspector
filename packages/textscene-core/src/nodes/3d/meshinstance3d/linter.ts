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
import { indexedKeyRegex, toIntIndex } from '../../../godot/index.js';

/**
 * `surface_material_override/<i>`, an index with no leaf below it. `_set` reads
 * it with a bare `p_name.get_slicec('/', 1).to_int()` and no validity gate
 * (mesh_instance_3d.cpp:66), so the grammar is the whole segment and
 * {@link toIntIndex} is what turns it into a number.
 *
 * Unanchored, because `get_slicec` returns that one slice and ignores the rest
 * (ustring.cpp:941-964): `surface_material_override/0/extra` names surface 0,
 * so its reference is as dangling as any other.
 */
const SURFACE_OVERRIDE_KEY_RE = indexedKeyRegex('^surface_material_override/(#)', 'to_int');

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
    const match = SURFACE_OVERRIDE_KEY_RE.exec(key);
    if (match) {
      const surfaceIndex = toIntIndex(match[1]!);
      // `_set` returns false for `idx < 0` (mesh_instance_3d.cpp:68), so the
      // override never lands and there is no surface to miss a material.
      if (!(surfaceIndex >= 0)) continue;

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

  return diagnostics;
}

/**
 * MeshInstance3D semantic validation rule
 */
const meshInstance3DValidationRule: LintRule = {
  meta: {
    name: 'valid-meshinstance3d-resources',
    description: 'Validates MeshInstance3D resource references',
    category: 'validation',
    // Matcher, not a name list: RuleRegistry matches applicableNodeTypes by
    // exact name, so SoftBody3D — which inherits `mesh` from MeshInstance3D —
    // got no resource-existence check at all.
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'MeshInstance3D'),
    emits: [
      {
        ruleName: 'valid-meshinstance3d-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the mesh, material, skin or surface-override id is undeclared in the file',
        },
      },
    ],
  },
  check: checkMeshInstance3D,
};

// Self-register the rule
ruleRegistry.register(meshInstance3DValidationRule);

// Export for testing
export { meshInstance3DValidationRule };
