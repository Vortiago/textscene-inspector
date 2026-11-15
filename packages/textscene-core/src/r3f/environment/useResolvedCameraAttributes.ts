/**
 * Resolves a CameraAttributes slot, `WorldEnvironment.camera_attributes` or `Camera3D.attributes`,
 * in the `SubResource` or the `ExtResource` form, with the `CAMERA_ATTRIBUTES` kind.
 */

import { useMemo } from 'react';
import { CAMERA_ATTRIBUTES } from '../../resources/cameraattributes/kind';
import { useNodeResource } from '../../resources/reading';
import type { CameraAttributesResolution } from './worldExposure';
import { NO_RESOLUTION, PENDING_RESOLUTION } from './worldGroup';

/** `pending` only while a `.tres` loads: an inline resource resolves on the first render. */
export function useResolvedCameraAttributes(
  cameraAttributesRef: string | undefined
): CameraAttributesResolution {
  const read = useNodeResource(cameraAttributesRef, CAMERA_ATTRIBUTES);
  return useMemo((): CameraAttributesResolution => {
    if (read.status === 'pending') return PENDING_RESOLUTION;
    if (read.status !== 'loaded') return NO_RESOLUTION;
    return { status: 'resolved', attributes: read.value };
  }, [read]);
}
