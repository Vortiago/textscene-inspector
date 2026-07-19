/**
 * Shared helpers for directional / spot lights that require a target object.
 * In three.js, DirectionalLight and SpotLight point at their `target` Object3D;
 * the conventional Godot orientation is "-Z forward", so we place the target
 * one unit in the local -Z direction inside the group.
 */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';

export interface LightWithTargetProps {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
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

export function LightWithTarget({
  name,
  position,
  rotation,
  scale,
  renderLight,
  children,
}: LightWithTargetProps) {
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  // Lazily initialised once; expose target via ref for the renderLight closure.
  // We deliberately don't store target in state to keep identity stable.
  useEffect(() => {
    targetRef.current.name = `${name}_target`;
  }, [name]);

  return (
    <group name={name} position={position} rotation={rotation} scale={scale}>
      {renderLight(targetRef.current)}
      <primitive object={targetRef.current} position={[0, 0, -1]} />
      {children}
    </group>
  );
}
