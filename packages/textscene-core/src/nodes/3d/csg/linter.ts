/**
 * A CSG leaf whose OWN geometry is degenerate — NOT a port of Godot's
 * `CSGShape3D::get_configuration_warnings()` (csg_shape.cpp:977-987):
 *
 *     const CSGShape3D *current_shape = this;
 *     while (current_shape) {
 *         if (!current_shape->brush || current_shape->brush->faces.is_empty()) {
 *             warnings.push_back(RTR("The CSGShape3D has an empty shape. ..."));
 *             break;
 *         }
 *         current_shape = current_shape->parent_shape;
 *     }
 *
 * That check walks `parent_shape` after `_get_brush()`'s manifold boolean
 * combination (csg_shape.cpp:453-511) — live CSG geometry no `.tscn` carries.
 * This rule is a narrower, genuinely useful value-add instead: does a leaf's
 * OWN declared geometry guarantee an empty brush regardless of any sibling
 * combined with it? A `CSGMesh3D` with no mesh, a `CSGPolygon3D` whose
 * `polygon` has fewer than 3 points, or a zero `size` component on a
 * `CSGBox3D` all build zero faces on their own (`csg_shape.cpp`'s
 * `_build_brush()` overrides for each), independent of any boolean operation
 * a parent applies to them. A NEGATIVE `CSGBox3D` size component does NOT
 * degenerate — see the check below.
 *
 * `CSGSphere3D.radius` (enforced, `csg_shape.cpp:1478`) and
 * `CSGCylinder3D.radius`/`height` and `CSGTorus3D.inner_radius`/`outer_radius`
 * (all hinted-positive already, that node's own `linterParser.ts`) already
 * reject or warn on a non-positive value, so this rule does not re-check
 * them — doing so would report the same defect twice.
 *
 * `applicableNodeTypeMatcher` reaches all 7 concrete CSG types
 * (`CSGCombiner3D`, `CSGMesh3D`, `CSGSphere3D`, `CSGBox3D`, `CSGCylinder3D`,
 * `CSGTorus3D`, `CSGPolygon3D`) — `CSGShape3D` itself is
 * `GDREGISTER_ABSTRACT_CLASS` (`modules/csg/register_types.cpp:41`) and is
 * never a node type in a `.tscn`. `CSGCombiner3D` has no geometry of its own
 * and this rule never emits for it; the other five carry no degenerate-size
 * check today so it stays quiet on them too.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { parseVector3 } from '../../../parser/vectors.js';
import { parsePackedVector2Array } from '../../../resources/shapes/packedArray.js';

const MISSING_MESH_RULE = 'csgmesh3d-requires-mesh';
const INSUFFICIENT_POINTS_RULE = 'csgpolygon3d-insufficient-points';
const DEGENERATE_SIZE_RULE = 'csgbox3d-degenerate-size';

function checkCSGShape3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // csg_shape.cpp:224-225: `Ref<Mesh> mesh` field-initialises to null (no
  // default assignment), so absence IS the trigger.
  if (node.type === 'CSGMesh3D' && !properties.mesh) {
    return [
      {
        severity: 'warning',
        message: `CSGMesh3D '${node.name}' has no mesh assigned, so it contributes no geometry to any CSG operation.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: MISSING_MESH_RULE,
      },
    ];
  }

  // csg_shape.cpp:2808-2829: `polygon` defaults to a unit square (4 points),
  // NOT an empty array — only a PRESENT, under-3-point polygon is degenerate.
  if (node.type === 'CSGPolygon3D' && properties.polygon) {
    try {
      const points = parsePackedVector2Array(properties.polygon).length / 2;
      if (points < 3) {
        return [
          {
            severity: 'warning',
            message: `CSGPolygon3D '${node.name}' has a polygon with ${points} point(s); at least 3 are needed for a solid shape.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: INSUFFICIENT_POINTS_RULE,
          },
        ];
      }
    } catch {
      return []; // malformed literal is linterParser.ts's job, not this rule's
    }
  }

  // csg_shape.h:277: `Vector3 size = Vector3(1, 1, 1)` — only a PRESENT,
  // ZERO component is degenerate. `_build_brush()` (csg_shape.cpp:1536,
  // vertex_mul = size / 2 at :1568) scales every face vertex componentwise by
  // half the size, so a NEGATIVE component only flips that axis's face
  // winding — the brush keeps the same non-zero extent (mirrored, not
  // collapsed). Verified with `godot --headless`: size (-1,1,1) and
  // size (-2,-2,-2) both produce the same AABB as their positive counterpart
  // (e.g. (-1,1,1) -> AABB size (1,1,1), identical to (1,1,1)); size (0,1,1)
  // collapses that one axis to zero width, and size (0,0,0) collapses to a
  // zero-size point — so ZERO, not "non-positive", is what degenerates.
  if (node.type === 'CSGBox3D' && properties.size) {
    try {
      const size = parseVector3(properties.size);
      if (size.x === 0 || size.y === 0 || size.z === 0) {
        return [
          {
            severity: 'warning',
            message: `CSGBox3D '${node.name}' has a zero size component (${properties.size}), so it has no volume.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: DEGENERATE_SIZE_RULE,
          },
        ];
      }
    } catch {
      return []; // malformed literal is linterParser.ts's job, not this rule's
    }
  }

  return [];
}

const csgShape3DDegenerateGeometryRule: LintRule = {
  meta: {
    name: 'valid-csgshape3d-own-geometry',
    description:
      'Flags a CSG leaf whose own declared geometry is degenerate: a CSGMesh3D with no mesh, a CSGPolygon3D under 3 points, or a zero CSGBox3D size component',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'CSGShape3D'),
    emits: [
      { ruleName: MISSING_MESH_RULE, severity: 'warning' },
      { ruleName: INSUFFICIENT_POINTS_RULE, severity: 'warning' },
      { ruleName: DEGENERATE_SIZE_RULE, severity: 'warning' },
    ],
  },
  check: checkCSGShape3D,
};

ruleRegistry.register(csgShape3DDegenerateGeometryRule);

export { csgShape3DDegenerateGeometryRule };
