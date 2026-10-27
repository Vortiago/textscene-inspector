/** Godot 4.6.3's CameraAttributes facts a scene's properties carry. */

/** `CameraAttributes`'s defaults (`scene/resources/camera_attributes.h:46`). */
export const CAMERA_ATTRIBUTES_DEFAULTS = {
  exposureMultiplier: 1,
} as const;

/**
 * The concrete classes of CameraAttributes, which `WorldEnvironment.camera_attributes` and
 * `Camera3D.attributes` accept (`world_environment.cpp:217`, `camera_3d.cpp:675`).
 *
 * @oneWay The classes a CameraAttributes slot accepts
 */
export const CAMERA_ATTRIBUTES_TYPES: readonly string[] = [
  'CameraAttributesPractical',
  'CameraAttributesPhysical',
];
