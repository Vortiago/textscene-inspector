/**
 * <PathFollow3D> — positions its children along the parent Path3D's curve.
 *
 * It reads the nearest ancestor Path3D's curve via Path3DCurveContext, samples
 * the point at `progress_ratio` (preferred) or absolute `progress` (looping when
 * `loop`), orients children to the tangent per `rotation_mode` (model front is
 * -Z, or +Z with `use_model_front`), and nudges by `h_offset`/`v_offset` along
 * the oriented right/up axes. That computed transform drives the group (Godot
 * derives the follower's transform from the curve, overriding the authored one).
 *
 * With no curve in scope it falls back to its authored Node3D transform (matching
 * the prior transform-only behaviour). A small selection-gated cross marks the
 * follow point (ADR-0018).
 *
 * Approximation note: orientation aligns the model-front axis to the tangent for
 * any non-NONE rotation_mode (Y/XY/XYZ/ORIENTED are not distinguished), and the
 * curve's per-point tilt (roll) is not applied — sufficient for a static preview.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { useParentPath3DCurve } from '../../../r3f/contexts/Path3DCurveContext';
import { transformFromNode3DProperties, type Vec3Tuple } from '../../../r3f/nodeTransform';
import type { Curve3DSampler } from '../../../resources/shapes/curve3d';
import { RotationMode, type PathFollow3DProperties } from './types';

/** Godot editor path-follow handle color (orange). */
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

  // No curve in scope → behave like a plain Node3D at the authored transform.
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

  const rawDistance =
    props.progress_ratio !== undefined
      ? props.progress_ratio * sampler.length
      : props.progress ?? 0;
  const distance = props.loop
    ? ((rawDistance % sampler.length) + sampler.length) % sampler.length
    : rawDistance;

  const sample = sampler.sampleAt(distance);
  const forward = new THREE.Vector3(sample.tangent.x, sample.tangent.y, sample.tangent.z);

  const quaternion = new THREE.Quaternion();
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  if (props.rotation_mode !== RotationMode.NONE && forward.lengthSq() > 0) {
    // Align the model-front axis (−Z by default, +Z with use_model_front) to the
    // tangent. setFromUnitVectors gives the minimal rotation, leaving roll free.
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
