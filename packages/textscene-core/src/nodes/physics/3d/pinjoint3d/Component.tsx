/**
 * <PinJoint3D>: a Node3D group that draws Godot's pin cross for every node, faint while unselected
 * (ADR-0056): three segments through the joint, when either body resolves
 * (`joint_3d_gizmo_plugin.cpp:462-471`).
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { JointGizmoLines } from '../joint3d/JointGizmoLines';
import { pinJointSegments } from '../joint3d/jointGizmoDrawer';
import type { Joint3DProperties } from '../joint3d/types';
import { useJointBodies } from '../joint3d/useJointBodies';

const PIN_SEGMENTS = pinJointSegments();

function PinGizmo({ properties }: { properties: Joint3DProperties }) {
  if (useJointBodies(properties) === null) return null;
  return <JointGizmoLines part="joint" positions={PIN_SEGMENTS} />;
}

export function PinJoint3D({ node, children }: NodeComponentProps) {
  return (
    <Node3D node={node}>
      <PluginGizmo drawnFor="every-node">
        <PinGizmo properties={node.properties as Joint3DProperties} />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
