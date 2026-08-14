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
 * combined with it? A `CSGMesh3D` with no mesh and a `CSGPolygon3D` whose
 * `polygon` has fewer than 3 points both build zero faces on their own
 * (`csg_shape.cpp`'s `_build_brush()` overrides for each), independent of any
 * boolean operation a parent applies to them.
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
 * never a node type in a `.tscn`. Only `CSGMesh3D` and `CSGPolygon3D` carry a
 * check, so the rule stays quiet on the other five.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { polygonPointCount } from '../../../linter/polygonPoints.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';

const MISSING_MESH_RULE = 'csgmesh3d-requires-mesh';
const INSUFFICIENT_POINTS_RULE = 'csgpolygon3d-insufficient-points';

function checkCSGShape3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // csg_shape.h:224: `Ref<Mesh> mesh` field-initialises to null (no default
  // assignment), so an empty slot IS the trigger, however it is spelled.
  if (node.type === 'CSGMesh3D' && resourceSlotIsEmpty(properties.mesh)) {
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
    // Counted, not decoded. The renderer's decoder throws on a component its
    // finite grammar refuses, so an `inf`-bearing polygon — which Godot loads
    // and counts like any other — silenced this warning entirely.
    const points = polygonPointCount(properties.polygon);
    if (points === null) return []; // malformed literal is linterParser.ts's job
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
  }

  return [];
}

const csgShape3DDegenerateGeometryRule: LintRule = {
  meta: {
    name: 'valid-csgshape3d-own-geometry',
    description:
      'Flags a CSG leaf whose own declared geometry is degenerate: a CSGMesh3D with no mesh, or a CSGPolygon3D under 3 points',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'CSGShape3D'),
    emits: [
      {
        ruleName: MISSING_MESH_RULE,
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'csg_shape.cpp:1126',
          unused: 'the build returns an empty brush, so the shape contributes no geometry',
        },
      },
      {
        ruleName: INSUFFICIENT_POINTS_RULE,
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'csg_shape.cpp:2154',
          unused: 'the build returns an empty brush, so the shape contributes no geometry',
        },
      },
    ],
  },
  check: checkCSGShape3D,
};

ruleRegistry.register(csgShape3DDegenerateGeometryRule);

export { csgShape3DDegenerateGeometryRule };
