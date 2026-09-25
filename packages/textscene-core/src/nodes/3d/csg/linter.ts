/**
 * A CSG leaf whose own geometry is degenerate. Not a port of
 * `CSGShape3D::get_configuration_warnings()` (csg_shape.cpp:977-987), which walks `parent_shape`
 * after `_get_brush()`'s boolean combination (csg_shape.cpp:453-511), live geometry no `.tscn`
 * carries. This asks whether a leaf's own geometry guarantees an empty brush, whatever its siblings.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { polygonPointCount } from '../../../linter/polygonPoints.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';

const MISSING_MESH_RULE = 'csgmesh3d-requires-mesh';
const INSUFFICIENT_POINTS_RULE = 'csgpolygon3d-insufficient-points';

// A `CSGMesh3D` with no mesh and a `CSGPolygon3D` under 3 points build zero faces on their own
// (`csg_shape.cpp`'s `_build_brush()` overrides). The other types carry no check: a non-positive
// size is already an error (`csg_shape.cpp:1478`, the sphere radius) or a hinted warning in that
// node's `linterParser.ts`, and reporting it here would double it.
function checkCSGShape3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // csg_shape.h:224: `Ref<Mesh> mesh` field-initialises to null (no default
  // assignment), so an empty slot is the trigger, however it is spelled.
  if (node.type === 'CSGMesh3D' && resourceSlotIsEmpty(properties.mesh)) {
    return [
      {
        severity: 'info',
        message: `CSGMesh3D '${node.name}' has no mesh assigned, so it contributes no geometry to any CSG operation.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: MISSING_MESH_RULE,
      },
    ];
  }

  // csg_shape.cpp:2808-2829: `polygon` defaults to a unit square (4 points),
  // not an empty array, so only a present, under-3-point polygon is degenerate.
  if (node.type === 'CSGPolygon3D' && properties.polygon) {
    const points = polygonPointCount(properties.polygon);
    if (points === null) return []; // malformed literal is linterParser.ts's job
    if (points < 3) {
      return [
        {
          severity: 'info',
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
    // Every concrete CSG type. `CSGShape3D` itself is `GDREGISTER_ABSTRACT_CLASS`
    // (`modules/csg/register_types.cpp:41`) and never a node type in a `.tscn`.
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'CSGShape3D'),
    emits: [
      {
        ruleName: MISSING_MESH_RULE,
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'csg_shape.cpp:1126',
          unused: 'the build returns an empty brush, so the shape contributes no geometry',
        },
      },
      {
        ruleName: INSUFFICIENT_POINTS_RULE,
        severity: 'info',
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
