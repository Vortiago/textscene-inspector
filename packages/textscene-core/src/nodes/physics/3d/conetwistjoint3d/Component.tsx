/**
 * <ConeTwistJoint3D>: a Node3D group that draws Godot's swing cone and twist spiral for every node,
 * faint while unselected (ADR-0056): one cone per resolved body, looking from the joint at it
 * (`joint_3d_gizmo_plugin.cpp:562-580`).
 */

import { useMemo } from 'react';
import type { Transform3D } from '../../../../godot/math/transform3d';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { JointGizmoLines } from '../joint3d/JointGizmoLines';
import { coneTwistBodySegments } from '../joint3d/jointGizmoDrawer';
import { useJointBodies } from '../joint3d/useJointBodies';
import { DEFAULT_SWING_SPAN, DEFAULT_TWIST_SPAN } from './types';
import type { ConeTwistJoint3DProperties } from './types';

function BodyCone({
  part,
  joint,
  body,
  swing,
  twist,
}: {
  part: 'bodyA' | 'bodyB';
  joint: Transform3D;
  body: Transform3D;
  swing: number;
  twist: number;
}) {
  const positions = useMemo(
    () => coneTwistBodySegments(joint, body, swing, twist),
    [joint, body, swing, twist]
  );
  return <JointGizmoLines part={part} positions={positions} />;
}

function ConeTwistGizmo({ properties }: { properties: ConeTwistJoint3DProperties }) {
  const bodies = useJointBodies(properties);
  if (bodies === null) return null;
  const swing = properties.swing_span ?? DEFAULT_SWING_SPAN;
  const twist = properties.twist_span ?? DEFAULT_TWIST_SPAN;
  return (
    <>
      {bodies.bodyA && (
        <BodyCone part="bodyA" joint={bodies.joint} body={bodies.bodyA} swing={swing} twist={twist} />
      )}
      {bodies.bodyB && (
        <BodyCone part="bodyB" joint={bodies.joint} body={bodies.bodyB} swing={swing} twist={twist} />
      )}
    </>
  );
}

export function ConeTwistJoint3D({ node, children }: NodeComponentProps) {
  return (
    <Node3D node={node}>
      <PluginGizmo drawnFor="every-node">
        <ConeTwistGizmo properties={node.properties as ConeTwistJoint3DProperties} />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
