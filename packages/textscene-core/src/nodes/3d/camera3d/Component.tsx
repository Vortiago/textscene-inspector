/**
 * <Camera3D>: renders a Godot Camera3D as a non-active R3F camera with Godot's editor gizmo, so
 * its placement shows in the editor viewport. The active viewport camera lives on the host
 * <Canvas>. This is a passive scene-tree node.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Camera as FiberCamera } from '@react-three/fiber';
import type { Camera3DProperties } from './types';
import { fitToAspect, fittedAspect, setLens, type CameraLens } from './projectionFit';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { Camera3DProjectionType } from '../../../godot/scene/camera3d';
import { CameraGizmo } from './Gizmo';
import { usePublishCamera } from '../../../r3f/environment/worldExposure';
import { useResolvedCameraAttributes } from '../../../r3f/environment/useResolvedCameraAttributes';

const DEFAULT_ASPECT = 16 / 9;

export function Camera3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as Camera3DProperties;
  const tscnPath = useNodePath() ?? node.name;
  usePublishCamera(tscnPath, properties.current, useResolvedCameraAttributes(properties.attributes));
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // `h_offset` / `v_offset` shift the camera along its local right / up vectors after the base
  // transform: the unnormalised basis_x / basis_y columns mixed into the world-space position.
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
  const lens = useMemo<CameraLens>(
    () => ({
      projection: properties.projection,
      fov: properties.fov,
      size: properties.size,
      keepAspect: properties.keep_aspect,
      frustumOffset: properties.frustum_offset,
    }),
    [
      properties.projection,
      properties.fov,
      properties.size,
      properties.keep_aspect,
      properties.frustum_offset,
    ]
  );
  const CameraElement =
    properties.projection === Camera3DProjectionType.ORTHOGONAL ? 'orthographicCamera' : 'perspectiveCamera';

  // PROJECTION_FRUSTUM draws through a perspective camera with a view offset. A new three camera
  // class remounts, through the key, the tag and the lens fit with it.
  return (
    <>
      <SceneCamera
        key={CameraElement}
        element={CameraElement}
        name={node.name}
        tscnPath={tscnPath}
        current={properties.current}
        position={offsetPosition}
        rotation={rotation}
        scale={scale}
        lens={lens}
        near={safeNear}
        far={safeFar}
      >
        {children}
      </SceneCamera>
      <CameraGizmo lens={lens} near={properties.near} position={position} rotation={rotation} scale={scale} />
    </>
  );
}

interface SceneCameraProps {
  element: 'perspectiveCamera' | 'orthographicCamera';
  name: string;
  tscnPath: string;
  /** Godot's `Camera3D.current`: which camera the owning viewport renders through. */
  current: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  lens: CameraLens;
  near: number;
  far: number;
  children?: ReactNode;
}

function SceneCamera({
  element: CameraElement,
  name,
  tscnPath,
  current,
  position,
  rotation,
  scale,
  lens,
  near,
  far,
  children,
}: SceneCameraProps) {
  const cameraRef = useRef<FiberCamera>(null);
  useEffect(() => {
    if (cameraRef.current) {
      // Tag the camera with its TSCN path so ActiveCameraSwitcher can find it,
      // and with `current` so a SubViewport can apply Godot's own election rule
      // (`camera_3d.cpp`: `if (current || first_camera)`) to its own cameras.
      cameraRef.current.userData.tscnPath = tscnPath;
      cameraRef.current.userData.tscnCurrent = current;
    }
  }, [tscnPath, current]);
  // `manual` keeps R3F's resize from refitting the projection to the canvas in pixels. The viewport
  // that renders through the camera refits it to its own aspect, and a lens change keeps that aspect.
  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.manual = true;
    setLens(camera, lens);
    fitToAspect(camera, fittedAspect(camera) ?? DEFAULT_ASPECT);
  }, [lens, near, far]);
  return (
    <CameraElement
      ref={cameraRef}
      name={name}
      position={position}
      rotation={rotation}
      scale={scale}
      near={near}
      far={far}
    >
      {children}
    </CameraElement>
  );
}
