/**
 * <ReflectionProbe>: puts a reflection probe into the scene at the node's transform, which the
 * scene's probes capture and draw (`r3f/reflectionProbe/sceneProbes.ts`). It draws nothing of its own,
 * but Godot's editor gizmo while it is selected (ADR-0018).
 */

import { extend } from '@react-three/fiber';
import { useTreeOrder } from '../../../r3f/contexts/TreeOrderContext';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { ReflectionProbeObject } from '../../../r3f/reflectionProbe/reflectionProbeObject';
import { useSceneProbes } from '../../../r3f/reflectionProbe/useSceneProbes';
import { Node3D } from '../../base/node3d/Component';
import { ReflectionProbeGizmo } from './Gizmo';
import type { ReflectionProbeProperties } from './types';

/** An element, not a `<primitive>`: it carries no material, and R3F sets its fields as props. */
const ReflectionProbeElement = extend(ReflectionProbeObject);

export function ReflectionProbe({ node, children }: NodeComponentProps) {
  useSceneProbes();
  const treeOrder = useTreeOrder();
  const gizmoVisible = useGizmoVisible();
  const probe = node.properties as ReflectionProbeProperties;
  return (
    <Node3D node={node}>
      <ReflectionProbeElement probe={probe} treeOrder={treeOrder} />
      {gizmoVisible && <ReflectionProbeGizmo probe={probe} />}
      {children}
    </Node3D>
  );
}
