/**
 * <Camera3D> — renders a Godot Camera3D as a non-active R3F camera
 * accompanied by a CameraHelper gizmo so the camera placement is
 * visible inside the editor viewport.
 *
 * The active viewport camera lives on the host <Canvas> — this is a
 * passive scene-tree node, not the camera the user is looking through.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Camera3DProperties } from '../../../nodes/3d/camera3d/types';
import { KeepAspectMode, ProjectionMode } from '../../../nodes/3d/camera3d/types';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import { useNodePath } from '../../contexts/NodePathContext';
import { useGizmoVisible } from '../lights/lightHelpers';

const DEFAULT_ASPECT = 16 / 9;

export function Camera3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as Camera3DProperties;
  const tscnPath = useNodePath() ?? node.name;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // WI-R3F-19 parity-audit fix: `h_offset` / `v_offset` shift the camera
  // along its LOCAL right / up vectors after the base transform is
  // applied. The pre-migration imperative renderer used
  // `addScaledVector(localX, h)` / `addScaledVector(localY, v)` — equivalent
  // to mixing the unnormalised basis_x / basis_y columns into the
  // world-space position.
  const offsetPosition = useMemo<[number, number, number]>(() => {
    const t = properties.transform;
    if (!t) return position;
    const h = properties.h_offset ?? 0;
    const v = properties.v_offset ?? 0;
    if (h === 0 && v === 0) return position;
    return [
      position[0] + t.basis_x.x * h + t.basis_y.x * v,
      position[1] + t.basis_x.y * h + t.basis_y.y * v,
      position[2] + t.basis_x.z * h + t.basis_y.z * v,
    ];
  }, [position, properties.transform, properties.h_offset, properties.v_offset]);

  const safeNear = Math.max(0.001, properties.near);
  const safeFar = Math.max(safeNear + 0.1, properties.far);

  if (properties.projection === ProjectionMode.PROJECTION_ORTHOGONAL) {
    return (
      <OrthographicCamera3D
        name={node.name}
        tscnPath={tscnPath}
        position={offsetPosition}
        rotation={rotation}
        scale={scale}
        size={properties.size}
        keepAspect={properties.keep_aspect}
        near={safeNear}
        far={safeFar}
      >
        {children}
      </OrthographicCamera3D>
    );
  }

  // PROJECTION_FRUSTUM is not yet supported — fall back to perspective.
  return (
    <PerspectiveCamera3D
      name={node.name}
      tscnPath={tscnPath}
      position={offsetPosition}
      rotation={rotation}
      scale={scale}
      fov={properties.fov}
      near={safeNear}
      far={safeFar}
    >
      {children}
    </PerspectiveCamera3D>
  );
}

interface PerspectiveCamera3DProps {
  name: string;
  tscnPath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  fov: number;
  near: number;
  far: number;
  children?: React.ReactNode;
}

function PerspectiveCamera3D({ name, tscnPath, position, rotation, scale, fov, near, far, children }: PerspectiveCamera3DProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  useEffect(() => {
    if (cameraRef.current) {
      // Tag the camera with its TSCN path so ActiveCameraSwitcher can find it.
      cameraRef.current.userData.tscnPath = tscnPath;
    }
  }, [tscnPath]);
  return (
    <>
      <perspectiveCamera
        ref={cameraRef}
        name={name}
        position={position}
        rotation={rotation}
        scale={scale}
        fov={fov}
        aspect={DEFAULT_ASPECT}
        near={near}
        far={far}
      >
        {children}
      </perspectiveCamera>
      <CameraGizmo cameraRef={cameraRef} name={`${name}_helper`} />
    </>
  );
}

interface OrthographicCamera3DProps {
  name: string;
  tscnPath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  size: number;
  keepAspect: KeepAspectMode;
  near: number;
  far: number;
  children?: React.ReactNode;
}

function OrthographicCamera3D({ name, tscnPath, position, rotation, scale, size, keepAspect, near, far, children }: OrthographicCamera3DProps) {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  // KEEP_HEIGHT (1, default): `size` is vertical, width derived from aspect.
  // KEEP_WIDTH (0): `size` is horizontal, height derived from aspect.
  const isKeepWidth = keepAspect === KeepAspectMode.KEEP_WIDTH;
  const halfHeight = isKeepWidth ? size / DEFAULT_ASPECT : size;
  const halfWidth = isKeepWidth ? size : size * DEFAULT_ASPECT;
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.userData.tscnPath = tscnPath;
    }
  }, [tscnPath]);
  return (
    <>
      <orthographicCamera
        ref={cameraRef}
        name={name}
        position={position}
        rotation={rotation}
        scale={scale}
        left={-halfWidth}
        right={halfWidth}
        top={halfHeight}
        bottom={-halfHeight}
        near={near}
        far={far}
      >
        {children}
      </orthographicCamera>
      <CameraGizmo cameraRef={cameraRef} name={`${name}_helper`} />
    </>
  );
}

interface CameraGizmoProps {
  cameraRef: React.RefObject<THREE.Camera | null>;
  name: string;
}

function CameraGizmo({ cameraRef, name }: CameraGizmoProps) {
  // WI-UX-14: gate on selection — same pattern as the light gizmos.
  // Without this, every Camera3D in the scene drew a yellow CameraHelper
  // frustum wireframe regardless of selection (ui-designer-2's A/B
  // finding on the hallway fixture). The gizmo now only appears when
  // the user has selected this Camera3D's tree row.
  const visible = useGizmoVisible();
  const [helper, setHelper] = useState<THREE.CameraHelper | null>(null);

  useEffect(() => {
    if (!visible) {
      setHelper(null);
      return;
    }
    const camera = cameraRef.current;
    if (!camera) return;
    const created = new THREE.CameraHelper(camera);
    created.name = name;
    setHelper(created);
    return () => {
      created.dispose?.();
    };
  }, [cameraRef, name, visible]);

  if (!visible || !helper) return null;
  return <primitive object={helper} />;
}
