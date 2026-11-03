/**
 * The group for a directional or spot light and its `target` Object3D. Godot
 * lights face -Z, so the target sits one unit along local -Z.
 */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { Aabb } from '../../../../godot/math/aabb';
import { NodeAabb } from '../../../../r3f/components/NodeAabb';
import { node3dGroupSpread, type NodeTransform } from '../../../../r3f/nodeTransform';

interface LightWithTargetProps {
  name: string;
  transform: NodeTransform;
  /** The `Light3D::get_aabb` of the light, which the selection box of its node takes. */
  aabb: Aabb;
  /**
   * Render-prop returning the light element. Receives the target object
   * the light should point at; pass it as the light's `target` prop.
   */
  renderLight: (target: THREE.Object3D) => ReactNode;
  /**
   * The node's dispatched scene-tree descendants. A light is an ordinary
   * Node3D in Godot, so anything parented under it renders at its own
   * transform relative to the light's.
   */
  children?: ReactNode;
}

export function LightWithTarget({ name, transform, aabb, renderLight, children }: LightWithTargetProps) {
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  // A ref, not state, keeps the target's identity stable across renders.
  useEffect(() => {
    targetRef.current.name = `${name}_target`;
  }, [name]);

  return (
    <group name={name} {...node3dGroupSpread(transform)}>
      <NodeAabb aabb={aabb} />
      {renderLight(targetRef.current)}
      <primitive object={targetRef.current} position={[0, 0, -1]} />
      {children}
    </group>
  );
}
