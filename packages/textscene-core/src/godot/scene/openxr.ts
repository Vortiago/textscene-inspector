/** Godot 4.6.3's OpenXR node facts a scene's properties carry. */

import { enumNamesByValue, labelEnumNames } from '../classdb/enumNames.js';

/**
 * `OpenXRCompositionLayer::Filter` (`modules/openxr/scene/openxr_composition_layer.h:49-53`), as
 * the integers `swapchain_state_min_filter` and `swapchain_state_mag_filter` store.
 */
const Filter = {
  NEAREST: 0,
  LINEAR: 1,
  CUBIC: 2,
} as const;

/** Each filter by its integer, spelled as its constant (`openxr_composition_layer.cpp:160-161`). */
export const COMPOSITION_FILTER_NAMES = enumNamesByValue(Filter);

/** `OpenXRCompositionLayer::MipmapMode` (`openxr_composition_layer.h:56-60`). */
const MipmapMode = {
  DISABLED: 0,
  NEAREST: 1,
  LINEAR: 2,
} as const;

/** Each mipmap mode by its integer, spelled as its constant (`openxr_composition_layer.cpp:162`). */
export const COMPOSITION_MIPMAP_MODE_NAMES = enumNamesByValue(MipmapMode);

/** `OpenXRCompositionLayer::Wrap` (`openxr_composition_layer.h:63-69`). */
const Wrap = {
  CLAMP_TO_BORDER: 0,
  CLAMP_TO_EDGE: 1,
  REPEAT: 2,
  MIRRORED_REPEAT: 3,
  MIRROR_CLAMP_TO_EDGE: 4,
} as const;

/** Each wrap mode by its integer, spelled as its constant (`openxr_composition_layer.cpp:163-164`). */
export const COMPOSITION_WRAP_NAMES = enumNamesByValue(Wrap);

/** `OpenXRCompositionLayer::Swizzle` (`openxr_composition_layer.h:72-79`). */
const Swizzle = {
  RED: 0,
  GREEN: 1,
  BLUE: 2,
  ALPHA: 3,
  ZERO: 4,
  ONE: 5,
} as const;

/** Each swizzle by its integer, spelled as its constant (`openxr_composition_layer.cpp:165-168`). */
export const COMPOSITION_SWIZZLE_NAMES = enumNamesByValue(Swizzle);

/** `OpenXRHand::Hands` (`openxr_hand.h:45-49`), `HAND_MAX` left out as a size marker. */
const Hand = { LEFT: 0, RIGHT: 1 } as const;

/** Each hand by its integer, as `openxr_hand.cpp:55` hints it. */
export const OPEN_XR_HAND_NAMES = labelEnumNames(Hand, { LEFT: 'Left', RIGHT: 'Right' });

/** `OpenXRHand::MotionRange` (`openxr_hand.h:51-55`), `MOTION_RANGE_MAX` left out. */
const MotionRange = { UNOBSTRUCTED: 0, CONFORM_TO_CONTROLLER: 1 } as const;

/** Each motion range by its integer, as `openxr_hand.cpp:56` hints it. */
export const MOTION_RANGE_NAMES = labelEnumNames(MotionRange, {
  UNOBSTRUCTED: 'Unobstructed',
  CONFORM_TO_CONTROLLER: 'Conform to controller',
});

/** `OpenXRHand::SkeletonRig` (`openxr_hand.h:57-61`), `SKELETON_RIG_MAX` left out. */
const SkeletonRig = { OPENXR: 0, HUMANOID: 1 } as const;

/** Each skeleton rig by its integer, as `openxr_hand.cpp:58` hints it. */
export const SKELETON_RIG_NAMES = labelEnumNames(SkeletonRig, {
  OPENXR: 'OpenXR',
  HUMANOID: 'Humanoid',
});

/** `OpenXRHand::BoneUpdate` (`openxr_hand.h:63-67`), `BONE_UPDATE_MAX` left out. */
const HandBoneUpdate = { FULL: 0, ROTATION_ONLY: 1 } as const;

/** Each hand bone update mode by its integer, as `openxr_hand.cpp:59` hints it. */
export const HAND_BONE_UPDATE_NAMES = labelEnumNames(HandBoneUpdate, {
  FULL: 'Full',
  ROTATION_ONLY: 'Rotation Only',
});

/** `OpenXRRenderModelManager::RenderModelTracker` (`openxr_render_model_manager.h:48-53`). */
const RenderModelTracker = {
  ANY: 0,
  NONE_SET: 1,
  LEFT_HAND: 2,
  RIGHT_HAND: 3,
} as const;

/** Each tracker by its integer, as `openxr_render_model_manager.cpp:44` hints it. */
export const RENDER_MODEL_TRACKER_NAMES = labelEnumNames(RenderModelTracker, {
  ANY: 'Any',
  NONE_SET: 'None set',
  LEFT_HAND: 'Left Hand',
  RIGHT_HAND: 'Right Hand',
});
