/**
 * <Generic6DOFJoint3D>: a Node3D group that draws the travel of its three axes and three circles per
 * resolved body for every node, faint while unselected (ADR-0056): each circle follows the angular
 * limit of its axis and looks from the joint at its body (`joint_3d_gizmo_plugin.cpp:582-723`).
 */

import { useCallback, useMemo } from 'react';
import { useByValue } from '../../../../r3f/hooks/useByValue';
import { identityTransform3D } from '../../../../godot/math/transform3d';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { JointBodyLines, type BodySegments } from '../joint3d/JointBodyLines';
import { JointGizmoLines } from '../joint3d/JointGizmoLines';
import { sixDofBodySegments, sixDofJointSegments } from '../joint3d/jointGizmoDrawer';
import { useJointBodies, type JointBodies } from '../joint3d/useJointBodies';
import { drawnLimits, sameLimits, type Generic6DOFJoint3DProperties } from './types';

/** `Transform3D()`, the transform `redraw` passes for a body that does not resolve (`:446-447`). */
const UNRESOLVED_BODY = identityTransform3D();

/**
 * The bodies `redraw` draws circles for (`:450`): it hands body B's points over only when body A
 * resolves, and then draws body B toward the world origin where B itself does not resolve.
 */
function bodiesDrawn(bodies: JointBodies): JointBodies {
  if (!bodies.bodyA) return { ...bodies, bodyB: null };
  return { ...bodies, bodyB: bodies.bodyB ?? UNRESOLVED_BODY };
}

function SixDofGizmo({ properties }: { properties: Generic6DOFJoint3DProperties }) {
  const bodies = useJointBodies(properties);
  const limits = useByValue(drawnLimits(properties), sameLimits);
  const travel = useMemo(() => sixDofJointSegments(limits), [limits]);
  const segmentsFor = useCallback<BodySegments>(
    (joint, body, part) => sixDofBodySegments(joint, body, part, limits),
    [limits]
  );
  if (bodies === null) return null;
  return (
    <>
      <JointGizmoLines part="joint" positions={travel} />
      <JointBodyLines bodies={bodiesDrawn(bodies)} segmentsFor={segmentsFor} />
    </>
  );
}

export function Generic6DOFJoint3D({ node, children }: NodeComponentProps) {
  return (
    <Node3D node={node}>
      <PluginGizmo drawnFor="every-node">
        <SixDofGizmo properties={node.properties as Generic6DOFJoint3DProperties} />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
