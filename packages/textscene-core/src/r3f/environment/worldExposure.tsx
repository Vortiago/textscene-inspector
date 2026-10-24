/**
 * The exposure of a world: the CameraAttributes its first valid WorldEnvironment holds, chosen apart
 * from the Environment (`world_environment.cpp:87-93`). Godot scales the frame by the attributes'
 * exposure normalisation factor, which is the `exposure_multiplier` while the project uses no
 * physical light units (`camera_attributes_storage.cpp:133-138`, `camera_attributes.cpp:56-64`).
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { CameraAttributes } from '../../resources/cameraattributes/types';
import { useSceneExposure } from '../exposure/sceneExposure';
import { createWorldGroup } from './worldGroup';

/** What a WorldEnvironment's `camera_attributes` resolves to. */
export type CameraAttributesResolution =
  { status: 'pending' } | { status: 'none' } | { status: 'resolved'; attributes: CameraAttributes };

export const PENDING_CAMERA_ATTRIBUTES: CameraAttributesResolution = { status: 'pending' };
export const NO_CAMERA_ATTRIBUTES: CameraAttributesResolution = { status: 'none' };

const cameraAttributes = createWorldGroup<CameraAttributesResolution>(NO_CAMERA_ATTRIBUTES);

export const usePublishCameraAttributes = cameraAttributes.usePublish;

/** Null with no valid CameraAttributes, which Godot's frame does not scale at all. */
const ExposureContext = createContext<number | null>(null);

/** Chooses the world's CameraAttributes and gives its readers the exposure. One per world. */
export function WorldExposureScope({ children }: { children: ReactNode }) {
  return (
    <cameraAttributes.Provider>
      <ExposureProvider>{children}</ExposureProvider>
    </cameraAttributes.Provider>
  );
}

function ExposureProvider({ children }: { children: ReactNode }) {
  const chosen = cameraAttributes.useChosen();
  const normalization = chosen?.status === 'resolved' ? chosen.attributes.exposureMultiplier : null;
  useSceneExposure(normalization ?? 1);
  return <ExposureContext.Provider value={normalization}>{children}</ExposureContext.Provider>;
}

/**
 * The world's exposure normalisation factor, or null without CameraAttributes. A lightmap needs the
 * difference: with no attributes it reads 1, not the factor over its baked exposure
 * (`render_forward_clustered.cpp:1222-1229`).
 */
export function useExposureNormalization(): number | null {
  return useContext(ExposureContext);
}

/** The factor a consumer scales by: 1 without CameraAttributes. */
export function useExposureFactor(): number {
  return useExposureNormalization() ?? 1;
}
