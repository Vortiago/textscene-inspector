/**
 * <Bone2D> positions its children and draws Godot's editor kite from itself to each Bone2D child, or
 * along its length where it has none, for every node in full colour (`skeleton_2d.cpp:189-310`,
 * ADR-0056). The editor draws it in the editor only, so the Gizmos toggle and the bone's own
 * `editor_settings/show_bone_gizmo` hide it.
 */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useGizmoDrawn } from '../../../r3f/hooks/useGizmoState';
import { Node2D } from '../../base/node2d/Component';
import { BoneKites } from './BoneKites';
import type { Bone2DProperties } from './types';

export function Bone2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Bone2DProperties;
  const drawsKites = useGizmoDrawn('every-node') && props.show_bone_gizmo;
  return (
    <Node2D node={node}>
      {drawsKites && <BoneKites node={node} />}
      {children}
    </Node2D>
  );
}
