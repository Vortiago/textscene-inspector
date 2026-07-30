/**
 * Dimension-parameterized semantic linter rule for VehicleWheel3D.
 *
 * Godot has no 2D vehicle wheel, so `dim` is always '3D' today; the factory
 * shape matches the sibling physics rules and is what ruleCoverage derives the
 * rule name from.
 *
 * Format validation lives in the slice's linterParser.ts. This rule covers the
 * three things only full scene context (or the Godot docs) can decide: whether
 * the wheel is where Godot needs it, and whether its suspension numbers fall
 * outside the ranges the class reference recommends.
 *
 * Everything here is a WARNING. A wheel with odd suspension still parses,
 * renders and simulates, and real scenes routinely tune well outside the
 * documented range, so an error would reject working content over a preference.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { findParentNode } from '../linterUtils.js';
import { rangeAdvisories } from '../rangeAdvisory.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

/** VehicleWheel3D.suspension_travel: "try a value between 0.1 and 0.3". */
const MIN_RECOMMENDED_TRAVEL = 0.1;
const MAX_RECOMMENDED_TRAVEL = 0.3;

/**
 * The two damping defaults from the class reference. Transcribed here rather
 * than imported from the slice's types.ts: the linter half of the bundle never
 * reaches into `nodes/` (the dependency runs the other way), and the rule
 * factory's signature is pinned to `(dim)` by the ruleCoverage meta-guard, so
 * they cannot be injected either. They differ — an unauthored side is NOT
 * interchangeable with the other one.
 */
const DEFAULT_DAMPING_COMPRESSION = 0.83;
const DEFAULT_DAMPING_RELAXATION = 0.88;

export function makeVehicleWheelLinterRule(dim: PhysicsDim): LintRule {
  const type = `VehicleWheel${dim}`;
  const bodyType = `VehicleBody${dim}`;
  const prefix = `vehiclewheel${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    if (node.type !== type) {
      return diagnostics;
    }

    const rawProps = node.properties as unknown as Record<string, string>;

    // Godot: "VehicleWheel3D serves to provide a wheel system to a VehicleBody3D.
    // Please use it as a child of a VehicleBody3D." It is a DIRECT-child
    // requirement — a wheel under an intermediate Node3D is not picked up.
    const parent = findParentNode(scene.nodes, node);
    if (parent === null || parent.type !== bodyType) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' is not a direct child of a ${bodyType}. Godot only attaches wheels that are direct children of the vehicle body; this wheel will do nothing.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-not-under-vehicle-body`,
      });
    }

    const outOfRange = `${prefix}-suspension-travel-out-of-range`;
    const travelMessage = (value: number): string =>
      `${type} '${node.name}' has suspension_travel ${value}, outside the recommended ${MIN_RECOMMENDED_TRAVEL}–${MAX_RECOMMENDED_TRAVEL} range. Values far outside it make the suspension floaty or rigid.`;
    diagnostics.push(
      ...rangeAdvisories(node, {
        suspension_travel: [
          { under: MIN_RECOMMENDED_TRAVEL, ruleName: outOfRange, message: travelMessage },
          { over: MAX_RECOMMENDED_TRAVEL, ruleName: outOfRange, message: travelMessage },
        ],
      })
    );

    // Godot: damping_relaxation "should be slightly higher than
    // damping_compression". Either side may be left unauthored — real wheels
    // routinely set only compression — so the missing one is substituted with
    // its Godot default. The pair of defaults already satisfies the
    // recommendation (0.83 < 0.88), so a wheel that authors neither, or only
    // the one Godot ships, stays quiet; a wheel that authors ONLY the side that
    // breaks the relationship is exactly the misconfiguration this catches.
    if (rawProps.damping_compression !== undefined || rawProps.damping_relaxation !== undefined) {
      const compression =
        rawProps.damping_compression === undefined
          ? DEFAULT_DAMPING_COMPRESSION
          : parseFloat(rawProps.damping_compression);
      const relaxation =
        rawProps.damping_relaxation === undefined
          ? DEFAULT_DAMPING_RELAXATION
          : parseFloat(rawProps.damping_relaxation);
      if (!isNaN(compression) && !isNaN(relaxation) && relaxation < compression) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has damping_relaxation (${relaxation}) below damping_compression (${compression}). Godot recommends relaxation be the higher of the two, or the wheel rebounds faster than it compresses.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-damping-relaxation-below-compression`,
        });
      }
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} placement under a ${bodyType} and its suspension configuration`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `${prefix}-not-under-vehicle-body`, severity: 'warning' },
        { ruleName: `${prefix}-suspension-travel-out-of-range`, severity: 'warning' },
        { ruleName: `${prefix}-damping-relaxation-below-compression`, severity: 'warning' },
      ],
    },
    check,
  };
}
