/**
 * <SliderJoint3D>: a Node3D group that draws Godot's slider travel and one circle around X per
 * resolved body for every node, faint while unselected (ADR-0056): the circle follows the angular
 * limits and looks from the joint at its body (`joint_3d_gizmo_plugin.cpp:503-560`).
 */

import { useCallback, useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { JointBodyLines, type BodySegments } from '../joint3d/JointBodyLines';
import { JointGizmoLines } from '../joint3d/JointGizmoLines';
import { sliderBodySegments, sliderJointSegments } from '../joint3d/jointGizmoDrawer';
import { useJointBodies } from '../joint3d/useJointBodies';
import { drawnLimits, type SliderJoint3DProperties } from './types';

function SliderGizmo({ properties }: { properties: SliderJoint3DProperties }) {
  const bodies = useJointBodies(properties);
  const { linearLower, linearUpper, angularLower, angularUpper } = drawnLimits(properties);
  const travel = useMemo(() => sliderJointSegments(linearLower, linearUpper), [linearLower, linearUpper]);
  const segmentsFor = useCallback<BodySegments>(
    (joint, body, part) => sliderBodySegments(joint, body, part, angularLower, angularUpper),
    [angularLower, angularUpper]
  );
  if (bodies === null) return null;
  return (
    <>
      <JointGizmoLines part="joint" positions={travel} />
      <JointBodyLines bodies={bodies} segmentsFor={segmentsFor} />
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
