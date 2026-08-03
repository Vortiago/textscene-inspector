/**
 * Semantic linter rule for VehicleWheel3D: its parent must be a VehicleBody3D.
 *
 * `VehicleWheel3D::get_configuration_warnings` (scene/3d/physics/vehicle_body_3d.cpp)
 * overrides the base and adds exactly one warning:
 *
 *   if (!Object::cast_to<VehicleBody3D>(get_parent())) {
 *     warnings.push_back(RTR("VehicleWheel3D serves to provide a wheel system to a
 *     VehicleBody3D. Please use it as a child of a VehicleBody3D."));
 *   }
 *
 * That is the only cross-field check the class contributes; every other member
 * is a plain format/range validator (linterParser.ts). Format validation stays
 * there — this file exists only because this one check needs the whole scene
 * tree (the node's parent), which a per-property validator cannot see.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { findParentNode } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';

function checkVehicleWheel3DParent(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  const parent = findParentNode(scene.nodes, node);

  if (!parent) {
    return [
      {
        severity: 'warning',
        message:
          `VehicleWheel3D '${node.name}' has no parent node. VehicleWheel3D serves to provide ` +
          `a wheel system to a VehicleBody3D — use it as a child of a VehicleBody3D.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'vehiclewheel3d-no-parent',
      },
    ];
  }

  // An instanced sub-scene's root node carries `instance=` instead of `type=`
  // (Godot's own serialisation) — its real class lives in another file this
  // linter does not open, so whether it descends from VehicleBody3D is a
  // live-tree question it cannot answer (same caution as
  // nodes/2d/parallaxlayer/linter.ts and physics/joints/shared/linter.ts).
  // The corpus's 20 VehicleWheel3D nodes are all literal `type="VehicleBody3D"`
  // children in the same file, never this shape, so skipping it costs nothing
  // seen today and avoids flagging a wheel added as an editable child of an
  // instanced vehicle scene.
  if (parent.instance || !parent.type) return [];

  if (!descendsFrom(parent.type, 'VehicleBody3D')) {
    return [
      {
        severity: 'warning',
        message:
          `VehicleWheel3D '${node.name}' has parent '${parent.name}' of type '${parent.type}'. ` +
          `VehicleWheel3D serves to provide a wheel system to a VehicleBody3D — use it as a ` +
          `child of a VehicleBody3D.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'vehiclewheel3d-invalid-parent',
      },
    ];
  }

  return [];
}

const vehicleWheel3DParentRule: LintRule = {
  meta: {
    name: 'valid-vehiclewheel3d-parent',
    description: "Validates VehicleWheel3D sits under a VehicleBody3D, mirroring its own get_configuration_warnings",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'VehicleWheel3D'),
    emits: [
      { ruleName: 'vehiclewheel3d-no-parent', severity: 'warning' },
      { ruleName: 'vehiclewheel3d-invalid-parent', severity: 'warning' },
    ],
  },
  check: checkVehicleWheel3DParent,
};

ruleRegistry.register(vehicleWheel3DParentRule);

export { vehicleWheel3DParentRule };
