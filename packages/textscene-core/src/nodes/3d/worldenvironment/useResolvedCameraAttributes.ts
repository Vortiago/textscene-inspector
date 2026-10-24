/**
 * Resolves `WorldEnvironment.camera_attributes`, in the `SubResource` or the `ExtResource` form, as
 * Godot's property accepts a CameraAttributesPractical or a CameraAttributesPhysical and refuses any
 * other type (`world_environment.cpp:217`).
 */

import { useMemo } from 'react';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { decodeCameraAttributes } from '../../../resources/cameraattributes/decode';
import {
  NO_CAMERA_ATTRIBUTES,
  PENDING_CAMERA_ATTRIBUTES,
  type CameraAttributesResolution,
} from '../../../r3f/environment/worldExposure';

const CAMERA_ATTRIBUTES_TYPES: readonly string[] = ['CameraAttributesPractical', 'CameraAttributesPhysical'];

/** `pending` only while a `.tres` loads: an inline resource resolves on the first render. */
export function useResolvedCameraAttributes(
  cameraAttributesRef: string | undefined
): CameraAttributesResolution {
  const { scoped, status } = useResourceResolution(cameraAttributesRef, useSceneResources());
  const attributes = useMemo(
    () =>
      scoped && CAMERA_ATTRIBUTES_TYPES.includes(scoped.resource.type)
        ? decodeCameraAttributes(scoped.resource.data)
        : null,
    [scoped]
  );
  return useMemo((): CameraAttributesResolution => {
    if (status === 'pending') return PENDING_CAMERA_ATTRIBUTES;
    return attributes ? { status: 'resolved', attributes } : NO_CAMERA_ATTRIBUTES;
  }, [status, attributes]);
}
