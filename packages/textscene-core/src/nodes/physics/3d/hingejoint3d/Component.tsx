/**
 * <HingeJoint3D>: a Node3D group that draws Godot's hinge axis and one circle around Z per resolved
 * body for every node, faint while unselected (ADR-0056): the circle follows the angular limits and
 * looks from the joint at its body (`joint_3d_gizmo_plugin.cpp:473-501`).
 */

import { useCallback } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { JointBodyLines, type BodySegments } from '../joint3d/JointBodyLines';
import { JointGizmoLines } from '../joint3d/JointGizmoLines';
import { hingeBodySegments, hingeJointSegments } from '../joint3d/jointGizmoDrawer';
import { useJointBodies } from '../joint3d/useJointBodies';
import { drawnAngularLimits, type HingeJoint3DProperties } from './types';

const AXIS_SEGMENTS = hingeJointSegments();

function HingeGizmo({ properties }: { properties: HingeJoint3DProperties }) {
  const bodies = useJointBodies(properties);
  const { lower, upper } = drawnAngularLimits(properties);
  const segmentsFor = useCallback<BodySegments>(
    (joint, body, part) => hingeBodySegments(joint, body, part, lower, upper),
    [lower, upper]
  );
  if (bodies === null) return null;
  return (
    <>
      <JointGizmoLines part="joint" positions={AXIS_SEGMENTS} />
      <JointBodyLines bodies={bodies} segmentsFor={segmentsFor} />
    </>
  );
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
