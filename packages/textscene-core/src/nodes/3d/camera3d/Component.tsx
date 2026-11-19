/**
 * <Camera3D>: renders a Godot Camera3D as a non-active R3F camera with Godot's editor gizmo, so
 * its placement shows in the editor viewport. The active viewport camera lives on the host
 * <Canvas>. This is a passive scene-tree node.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ReactNode, RefObject } from 'react';
import type { Camera as FiberCamera } from '@react-three/fiber';
import type { Camera3DProperties } from './types';
import {
  fitToAspect,
  fittedAspect,
  setLens,
  type CameraLens,
} from '../../../r3f/viewportRender/projectionFit';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { Camera3DProjectionType } from '../../../godot/scene/camera3d';
import { CameraGizmo } from './Gizmo';
import { adjustCameraTransform } from './godotCameraTransform';
import { usePublishCamera } from '../../../r3f/environment/worldExposure';
import { useResolvedCameraAttributes } from '../../../r3f/environment/useResolvedCameraAttributes';
import { useRegisterSceneCamera } from '../../../r3f/sceneCameras';
import { useResolvedEnvironment } from '../worldenvironment/useResolvedEnvironment';

const DEFAULT_ASPECT = 16 / 9;

export function Camera3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as Camera3DProperties;
  const tscnPath = useNodePath() ?? node.name;
  usePublishCamera(tscnPath, {
    attributes: useResolvedCameraAttributes(properties.attributes),
    environment: useResolvedEnvironment(properties.environment),
  });
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

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
        position={position}
        hOffset={properties.h_offset ?? 0}
        vOffset={properties.v_offset ?? 0}
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

/** The world matrix draws through Godot's camera transform, while the node's children keep the node's. */
function useGodotCameraTransform(cameraRef: RefObject<FiberCamera | null>, hOffset: number, vOffset: number) {
  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return undefined;
    const base = Object.getPrototypeOf(camera) as THREE.Camera;
    const adjust = () => {
      // Only on a change: an inverse recomputed for an unchanged matrix moves a probe golden by 1/255.
      if (adjustCameraTransform(camera.matrixWorld, hOffset, vOffset)) {
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      }
    };
    camera.updateMatrixWorld = (force) => {
      camera.matrixWorldNeedsUpdate = true;
      base.updateMatrixWorld.call(camera, force);
      adjust();
    };
    camera.updateWorldMatrix = (updateParents, updateChildren) => {
      base.updateWorldMatrix.call(camera, updateParents, updateChildren);
      adjust();
    };
    camera.updateMatrixWorld(true);
    return () => {
      Reflect.deleteProperty(camera, 'updateMatrixWorld');
      Reflect.deleteProperty(camera, 'updateWorldMatrix');
    };
  }, [cameraRef, hOffset, vOffset]);
}

interface SceneCameraProps {
  element: 'perspectiveCamera' | 'orthographicCamera';
  name: string;
  tscnPath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  hOffset: number;
  vOffset: number;
  lens: CameraLens;
  near: number;
  far: number;
  children?: ReactNode;
}

function SceneCamera({
  element: CameraElement,
  name,
  tscnPath,
  position,
  rotation,
  scale,
  hOffset,
  vOffset,
  lens,
  near,
  far,
  children,
}: SceneCameraProps) {
  const cameraRef = useRef<FiberCamera>(null);
  useRegisterSceneCamera(tscnPath, cameraRef);
  useGodotCameraTransform(cameraRef, hOffset, vOffset);
  useEffect(() => {
    if (cameraRef.current) {
      // Tag the camera with its TSCN path so a SubViewport pass can find it.
      cameraRef.current.userData.tscnPath = tscnPath;
    }
  }, [tscnPath]);
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
