/**
 * <HingeJoint3D>: a Node3D group that draws Godot's hinge axis and one circle around Z per resolved
 * body for every node, faint while unselected (ADR-0056): the circle follows the angular limits and
 * looks from the joint at its body (`joint_3d_gizmo_plugin.cpp:473-501`).
 */

import { useMemo } from 'react';
import type { Transform3D } from '../../../../godot/math/transform3d';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { JointGizmoLines } from '../joint3d/JointGizmoLines';
import { hingeBodySegments, hingeJointSegments } from '../joint3d/jointGizmoDrawer';
import { useJointBodies } from '../joint3d/useJointBodies';
import { drawnAngularLimits, type HingeJoint3DProperties } from './types';

const AXIS_SEGMENTS = hingeJointSegments();

function HingeGizmo({ properties }: { properties: HingeJoint3DProperties }) {
  const bodies = useJointBodies(properties);
  const { lower, upper } = drawnAngularLimits(properties);
  if (bodies === null) return null;
  return (
    <>
      <JointGizmoLines part="joint" positions={AXIS_SEGMENTS} />
      {bodies.bodyA && (
        <HingeCircle part="bodyA" joint={bodies.joint} body={bodies.bodyA} lower={lower} upper={upper} />
      )}
      {bodies.bodyB && (
        <HingeCircle part="bodyB" joint={bodies.joint} body={bodies.bodyB} lower={lower} upper={upper} />
      )}
    </>
  );
}

function HingeCircle({
  part,
  joint,
  body,
  lower,
  upper,
}: {
  part: 'bodyA' | 'bodyB';
  joint: Transform3D;
  body: Transform3D;
  lower: number;
  upper: number;
}) {
  const positions = useMemo(
    () => hingeBodySegments(joint, body, part, lower, upper),
    [joint, body, part, lower, upper]
  );
  return <JointGizmoLines part={part} positions={positions} />;
}

export function HingeJoint3D({ node, children }: NodeComponentProps) {
  return (
    <Node3D node={node}>
      <PluginGizmo drawnFor="every-node">
        <HingeGizmo properties={node.properties as HingeJoint3DProperties} />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
