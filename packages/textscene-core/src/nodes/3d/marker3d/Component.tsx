/**
 * <Marker3D> — a Node3D transform anchor (positions its children) that draws a
 * 3-axis cross gizmo at its origin (X red, Y green, Z blue), mirroring Godot's
 * 3D editor marker.
 *
 * Godot draws this cross for every Marker3D "at all times"; we instead gate it on
 * selection via useGizmoVisible() — a deliberate viewer-vs-editor divergence to
 * keep a busy scene clean (ADR-0018, generalizing the light/camera gizmo gate).
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import type { Marker3DProperties } from './types';

export function Marker3D({ node, children }: NodeComponentProps) {
  const props = node.properties as Marker3DProperties;
  const gizmoVisible = useGizmoVisible();
  return (
    <Node3D node={node}>
      {gizmoVisible && <AxisCross extents={props.gizmo_extents} />}
      {children}
    </Node3D>
  );
}

function AxisCross({ extents }: { extents: number }) {
  const geometry = useMemo(() => {
    const e = extents > 0 ? extents : 0.25;
    // Three axis lines through the origin: X, Y, Z.
    const positions = new Float32Array([
      -e, 0, 0, e, 0, 0,
      0, -e, 0, 0, e, 0,
      0, 0, -e, 0, 0, e,
    ]);
    // Per-vertex axis colors: X red, Y green, Z blue.
    const colors = new Float32Array([
      1, 0, 0, 1, 0, 0,
      0, 1, 0, 0, 1, 0,
      0, 0, 1, 0, 0, 1,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [extents]);
  // R3F won't auto-dispose a geometry passed via `attach`; release on rebuild.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments renderOrder={10}>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial vertexColors depthWrite={false} transparent />
    </lineSegments>
  );
}
