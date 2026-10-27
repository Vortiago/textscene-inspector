/**
 * Resolves a CameraAttributes slot, `WorldEnvironment.camera_attributes` or `Camera3D.attributes`,
 * in the `SubResource` or the `ExtResource` form, as Godot's property accepts a
 * CameraAttributesPractical or a CameraAttributesPhysical and refuses any other type
 * (`world_environment.cpp:217`, `camera_3d.cpp:675`).
 */

import { useMemo } from 'react';
import { CAMERA_ATTRIBUTES_TYPES } from '../../godot/scene/cameraAttributes';
import { useSceneResources } from '../SceneResourcesContext';
import { useResourceResolution } from '../../resources/useSubOrExtResource';
import { decodeCameraAttributes } from '../../resources/cameraattributes/decode';
import type { CameraAttributesResolution } from './worldExposure';
import { NO_RESOLUTION, PENDING_RESOLUTION } from './worldGroup';

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
