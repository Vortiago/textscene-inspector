/** Godot 4.6.3's CameraAttributes facts a scene's properties carry. */

/**
 * `CameraAttributes`'s defaults (`scene/resources/camera_attributes.h:46-54`). The auto exposure
 * range starts at 0 and 800 ISO for Practical (`camera_attributes.cpp:309-310`) and at -8 and 10
 * EV100 for Physical (`:504-505`).
 */
export const CAMERA_ATTRIBUTES_DEFAULTS = {
  exposureMultiplier: 1,
  exposureSensitivity: 100,
  autoExposureScale: 0.4,
  practicalMinSensitivity: 0,
  practicalMaxSensitivity: 800,
  physicalMinExposureValue: -8,
  physicalMaxExposureValue: 10,
} as const;

/**
 * The concrete classes of CameraAttributes, which `WorldEnvironment.camera_attributes` and
 * `Camera3D.attributes` accept (`world_environment.cpp:217`, `camera_3d.cpp:675`).
 *
 * @canonical The classes a CameraAttributes slot accepts
 */
export const CAMERA_ATTRIBUTES_TYPES: readonly string[] = [
  'CameraAttributesPractical',
  'CameraAttributesPhysical',
];
