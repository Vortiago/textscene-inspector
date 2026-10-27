/**
 * Resolves `WorldEnvironment.camera_attributes`, in the `SubResource` or the `ExtResource` form, as
 * Godot's property accepts a CameraAttributesPractical or a CameraAttributesPhysical and refuses any
 * other type (`world_environment.cpp:217`).
 */

import { useMemo } from 'react';
import { CAMERA_ATTRIBUTES_TYPES } from '../../../godot/scene/cameraAttributes';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { decodeCameraAttributes } from '../../../resources/cameraattributes/decode';
import type { CameraAttributesResolution } from '../../../r3f/environment/worldExposure';
import { NO_RESOLUTION, PENDING_RESOLUTION } from '../../../r3f/environment/worldGroup';

/** `pending` only while a `.tres` loads: an inline resource resolves on the first render. */
export function useResolvedCameraAttributes(
  cameraAttributesRef: string | undefined
): CameraAttributesResolution {
  const { scoped, status } = useResourceResolution(cameraAttributesRef, useSceneResources());
  return useMemo((): CameraAttributesResolution => {
    if (status === 'pending') return PENDING_RESOLUTION;
    if (!scoped || !CAMERA_ATTRIBUTES_TYPES.includes(scoped.resource.type)) return NO_RESOLUTION;
    return { status: 'resolved', attributes: decodeCameraAttributes(scoped.resource.data) };
  }, [status, scoped]);
}
