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
import { ProjectionMode } from '../../../nodes/3d/camera3d/types';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import { useNodePath } from '../../contexts/NodePathContext';

const DEFAULT_ASPECT = 16 / 9;

export function Camera3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as Camera3DProperties;
  const tscnPath = useNodePath() ?? node.name;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const safeNear = Math.max(0.001, properties.near);
  const safeFar = Math.max(safeNear + 0.1, properties.far);

  if (properties.projection === ProjectionMode.PROJECTION_ORTHOGONAL) {
    return (
      <OrthographicCamera3D
        name={node.name}
        tscnPath={tscnPath}
        position={position}
        rotation={rotation}
        scale={scale}
        size={properties.size}
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
      position={position}
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
  near: number;
  far: number;
  children?: React.ReactNode;
}

function OrthographicCamera3D({ name, tscnPath, position, rotation, scale, size, near, far, children }: OrthographicCamera3DProps) {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  const halfHeight = size;
  const halfWidth = size * DEFAULT_ASPECT;
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
  const [helper, setHelper] = useState<THREE.CameraHelper | null>(null);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const created = new THREE.CameraHelper(camera);
    created.name = name;
    setHelper(created);
    return () => {
      created.dispose?.();
    };
  }, [cameraRef, name]);

  if (!helper) return null;
  return <primitive object={helper} />;
}
