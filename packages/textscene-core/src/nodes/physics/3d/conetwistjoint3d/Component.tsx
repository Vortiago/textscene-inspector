/**
 * <ConeTwistJoint3D>: a Node3D group that draws Godot's swing cone and twist spiral for every node,
 * faint while unselected (ADR-0056): one cone per resolved body, looking from the joint at it
 * (`joint_3d_gizmo_plugin.cpp:562-580`).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { JointBodyLines, type BodySegments } from '../joint3d/JointBodyLines';
import { coneTwistBodySegments, coneTwistLocalSegments } from '../joint3d/jointGizmoDrawer';
import { useJointBodies } from '../joint3d/useJointBodies';
import { DEFAULT_SWING_SPAN, DEFAULT_TWIST_SPAN } from './types';
import type { ConeTwistJoint3DProperties } from './types';

function ConeTwistGizmo({ properties }: { properties: ConeTwistJoint3DProperties }) {
  const bodies = useJointBodies(properties);
  const swing = properties.swing_span ?? DEFAULT_SWING_SPAN;
  const twist = properties.twist_span ?? DEFAULT_TWIST_SPAN;
  const segmentsFor = useMemo<BodySegments>(() => {
    const local = coneTwistLocalSegments(swing, twist);
    return (joint, body) => coneTwistBodySegments(joint, body, local);
  }, [swing, twist]);
  if (bodies === null) return null;
  return <JointBodyLines bodies={bodies} segmentsFor={segmentsFor} />;
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
