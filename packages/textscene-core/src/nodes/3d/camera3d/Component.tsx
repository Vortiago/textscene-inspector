/**
 * <Camera3D> — renders a Godot Camera3D as a non-active R3F camera
 * accompanied by a CameraHelper gizmo so the camera placement is
 * visible inside the editor viewport.
 *
 * The active viewport camera lives on the host <Canvas> — this is a
 * passive scene-tree node, not the camera the user is looking through.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import * as THREE from 'three';
import type { Camera3DProperties } from './types';
import { KeepAspectMode, ProjectionMode } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useGizmoVisible } from '../lights/shared/lightHelpers';
import { usePrimitiveHelper, correctHelperForParentGroup } from '../../../r3f/hooks/useTHREEHelper';

const DEFAULT_ASPECT = 16 / 9;

export function Camera3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as Camera3DProperties;
  const tscnPath = useNodePath() ?? node.name;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // Parity-audit fix: `h_offset` / `v_offset` shift the camera
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
  // With keep_aspect = KEEP_WIDTH the stored fov is the HORIZONTAL fov; three.js
  // PerspectiveCamera.fov is vertical, so convert (Godot's get_fovy).
  const perspectiveFov =
    properties.keep_aspect === KeepAspectMode.KEEP_WIDTH
      ? (2 * Math.atan(Math.tan((properties.fov * Math.PI) / 180 / 2) / DEFAULT_ASPECT) * 180) /
        Math.PI
      : properties.fov;
  return (
    <PerspectiveCamera3D
      name={node.name}
      tscnPath={tscnPath}
      position={offsetPosition}
      rotation={rotation}
      scale={scale}
      fov={perspectiveFov}
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
  children?: ReactNode;
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
  children?: ReactNode;
}

function OrthographicCamera3D({ name, tscnPath, position, rotation, scale, size, keepAspect, near, far, children }: OrthographicCamera3DProps) {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  // Godot `size` is the FULL frustum dimension (diameter), so the half-extent
  // is size/2 (Projection::set_orthogonal divides by 2). KEEP_HEIGHT (1,
  // default): `size` is the vertical dimension, width derived from aspect.
  // KEEP_WIDTH (0): `size` is horizontal, height derived from aspect.
  const isKeepWidth = keepAspect === KeepAspectMode.KEEP_WIDTH;
  const halfHeight = (isKeepWidth ? size / DEFAULT_ASPECT : size) / 2;
  const halfWidth = (isKeepWidth ? size : size * DEFAULT_ASPECT) / 2;
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
  cameraRef: RefObject<THREE.Camera | null>;
  name: string;
}

function CameraGizmo({ cameraRef, name }: CameraGizmoProps) {
  // Gate on selection — same pattern as the light gizmos.
  // Without this, every Camera3D in the scene drew a yellow CameraHelper
  // frustum wireframe regardless of selection (ui-designer-2's A/B
  // finding on the hallway fixture). The gizmo now only appears when
  // the user has selected this Camera3D's tree row.
  //
  // Build + dispose lifecycle delegated to `usePrimitiveHelper`.
  // `THREE.CameraHelper` shares `DirectionalLightHelper`/`PointLightHelper`'s
  // `this.matrix = camera.matrixWorld` + `matrixAutoUpdate = false`
  // constructor aliasing — mounted as a `<primitive>` SIBLING of the camera
  // inside the node's own transform group (not `scene.add()`'d at the root,
  // as the constructor's doc example assumes), a transformed ancestor would
  // otherwise double-transform the frustum. `correctHelperForParentGroup`
  // fixes it (see its doc comment in `r3f/hooks/useTHREEHelper.ts`); its
  // wrapped `update()` is what applies the correction, so `tickUpdate` must
  // stay at its default (true) even though the frustum geometry itself is
  // static — the per-frame cost is negligible (one Matrix4 invert) and only
  // paid while this Camera3D is the selected node.
  const visible = useGizmoVisible();
  const helper = usePrimitiveHelper<THREE.CameraHelper>(() => {
    if (!visible) return null;
    const camera = cameraRef.current;
    if (!camera) return null;
    const created = new THREE.CameraHelper(camera);
    created.name = name;
    return correctHelperForParentGroup(created, camera);
  }, [cameraRef, name, visible]);

  return helper ? <primitive object={helper} /> : null;
}
