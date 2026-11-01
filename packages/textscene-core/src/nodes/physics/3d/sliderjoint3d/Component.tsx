/**
 * <SliderJoint3D>: a Node3D group that draws Godot's slider travel and one circle around X per
 * resolved body for every node, faint while unselected (ADR-0056): the circle follows the angular
 * limits and looks from the joint at its body (`joint_3d_gizmo_plugin.cpp:503-560`).
 */

import { useMemo } from 'react';
import type { Transform3D } from '../../../../godot/math/transform3d';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { JointGizmoLines } from '../joint3d/JointGizmoLines';
import { sliderBodySegments, sliderJointSegments } from '../joint3d/jointGizmoDrawer';
import { useJointBodies } from '../joint3d/useJointBodies';
import {
  DEFAULT_ANGULAR_LIMIT,
  DEFAULT_LINEAR_LOWER,
  DEFAULT_LINEAR_UPPER,
  type SliderJoint3DProperties,
} from './types';

function SliderCircle({
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
    () => sliderBodySegments(joint, body, part, lower, upper),
    [joint, body, part, lower, upper]
  );
  return <JointGizmoLines part={part} positions={positions} />;
}

function SliderGizmo({ properties }: { properties: SliderJoint3DProperties }) {
  const bodies = useJointBodies(properties);
  const linearLower = properties['linear_limit/lower_distance'] ?? DEFAULT_LINEAR_LOWER;
  const linearUpper = properties['linear_limit/upper_distance'] ?? DEFAULT_LINEAR_UPPER;
  const lower = properties['angular_limit/lower_angle'] ?? DEFAULT_ANGULAR_LIMIT;
  const upper = properties['angular_limit/upper_angle'] ?? DEFAULT_ANGULAR_LIMIT;
  const travel = useMemo(() => sliderJointSegments(linearLower, linearUpper), [linearLower, linearUpper]);
  if (bodies === null) return null;
  return (
    <>
      <JointGizmoLines part="joint" positions={travel} />
      {bodies.bodyA && (
        <SliderCircle part="bodyA" joint={bodies.joint} body={bodies.bodyA} lower={lower} upper={upper} />
      )}
      {bodies.bodyB && (
        <SliderCircle part="bodyB" joint={bodies.joint} body={bodies.bodyB} lower={lower} upper={upper} />
      )}
    </>
  );
}

export function SliderJoint3D({ node, children }: NodeComponentProps) {
  return (
    <Node3D node={node}>
      <PluginGizmo drawnFor="every-node">
        <SliderGizmo properties={node.properties as SliderJoint3DProperties} />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
