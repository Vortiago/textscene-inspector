/**
 * <PathFollow3D>: positions its children along the nearest ancestor Path3D's curve
 * (Path3DCurveContext), at absolute `progress`, oriented to the tangent and nudged by
 * `h_offset`/`v_offset`. Like Godot, this transform overrides the authored one. With no curve
 * in scope it keeps the authored Node3D transform. A selection-gated cross marks the point (ADR-0018).
 */

// Approximation: every non-NONE rotation_mode aligns the model front (-Z, or +Z with
// `use_model_front`) to the tangent, so Y/XY/XYZ/ORIENTED look alike, and the curve's per-point
// tilt (roll) is not applied.

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { useParentPath3DCurve } from '../../../r3f/contexts/Path3DCurveContext';
import { transformFromNode3DProperties, type Vec3Tuple } from '../../../r3f/nodeTransform';
import type { Curve3DSampler } from '../../../resources/curves/curve3d';
import { RotationMode, type PathFollow3DProperties } from './types';

/** Godot editor path-follow handle colour. */
const FOLLOW_COLOR = 0xffa733;

// A small 3-axis cross (extent 0.25) at the follow point.
const FOLLOW_CROSS_POSITIONS = new Float32Array([
  -0.25, 0, 0, 0.25, 0, 0,
  0, -0.25, 0, 0, 0.25, 0,
  0, 0, -0.25, 0, 0, 0.25,
]);

interface FollowTransform {
  position: Vec3Tuple;
  quaternion: [number, number, number, number];
  scale: Vec3Tuple;
}

export function PathFollow3D({ node, children }: NodeComponentProps) {
  const props = node.properties as PathFollow3DProperties;
  const sampler = useParentPath3DCurve();
  const gizmoVisible = useGizmoVisible();

  const follow = useMemo(() => computeFollowTransform(sampler, props), [sampler, props]);
  const dot = gizmoVisible ? <FollowCross /> : null;

  // No curve in scope: behave like a plain Node3D at the authored transform.
  if (!follow) {
    return (
      <Node3D node={node}>
        {dot}
        {children}
      </Node3D>
    );
  }

  return (
    <group
      name={node.name}
      position={follow.position}
      quaternion={follow.quaternion}
      scale={follow.scale}
      visible={props.visible !== false}
    >
      {dot}
      {children}
    </group>
  );
}

function computeFollowTransform(
  sampler: Curve3DSampler | null,
  props: PathFollow3DProperties
): FollowTransform | null {
  if (!sampler || sampler.length <= 0) return null;

  // `progress` alone, unwrapped. Godot sets stored properties before parenting
  // (packed_scene.cpp:492 sets, :541 parents) and binds `path` on enter-tree, so
  // `set_progress_ratio` refuses every authored ratio (path_3d.cpp:503) and `set_progress`
  // skips its wrap. Only the sampler's clamp (curve.cpp:2024) applies, whatever `loop` says.
  const sample = sampler.sampleAt(props.progress ?? 0);
  const forward = new THREE.Vector3(sample.tangent.x, sample.tangent.y, sample.tangent.z);

  const quaternion = new THREE.Quaternion();
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  if (props.rotation_mode !== RotationMode.NONE && forward.lengthSq() > 0) {
    // setFromUnitVectors gives the minimal rotation onto the tangent, leaving roll free.
    const modelFront = new THREE.Vector3(0, 0, props.use_model_front ? 1 : -1);
    quaternion.setFromUnitVectors(modelFront, forward.clone().normalize());
    right.applyQuaternion(quaternion);
    up.applyQuaternion(quaternion);
  }

  const scale = transformFromNode3DProperties(props).scale;
  return {
    position: [
      sample.x + right.x * props.h_offset + up.x * props.v_offset,
      sample.y + right.y * props.h_offset + up.y * props.v_offset,
      sample.z + right.z * props.h_offset + up.z * props.v_offset,
    ],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    scale,
  };
}

function FollowCross() {
  return <GizmoLine positions={FOLLOW_CROSS_POSITIONS} color={FOLLOW_COLOR} />;
}
