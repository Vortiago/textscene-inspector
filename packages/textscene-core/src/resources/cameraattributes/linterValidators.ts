/**
 * CameraAttributes property validation (`scene/resources/camera_attributes.cpp`). No setter
 * refuses or clamps a value, so every bound is the hinted tier. A hint with `or_greater` states
 * a floor only; `exp` scales the slider and opens no end. The base class owns the exposure and
 * auto-exposure keys, and each subclass registers only its own.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../resource/linterValidators.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

const baseKeys: Record<string, PropertyValidator> = {
  // camera_attributes.cpp:127
  exposure_sensitivity: v.float('exposure_sensitivity', {
    min: 0.1,
    max: 32000,
    hinted: 'camera_attributes.cpp:127',
  }),
  // camera_attributes.cpp:128, `or_greater`: floor only.
  exposure_multiplier: v.nonNegativeFloat('exposure_multiplier', { hinted: 'camera_attributes.cpp:128' }),
  auto_exposure_enabled: v.boolean('auto_exposure_enabled'),
  // camera_attributes.cpp:132-133
  auto_exposure_scale: v.float('auto_exposure_scale', {
    min: 0.01,
    max: 64,
    hinted: 'camera_attributes.cpp:132',
  }),
  auto_exposure_speed: v.float('auto_exposure_speed', {
    min: 0.01,
    max: 64,
    hinted: 'camera_attributes.cpp:133',
  }),
};

const practicalKeys: Record<string, PropertyValidator> = {
  dof_blur_far_enabled: v.boolean('dof_blur_far_enabled'),
  // camera_attributes.cpp:294-295 and :297-298
  dof_blur_far_distance: v.float('dof_blur_far_distance', {
    min: 0.01,
    max: 8192,
    hinted: 'camera_attributes.cpp:294',
  }),
  dof_blur_far_transition: v.float('dof_blur_far_transition', {
    min: -1,
    max: 8192,
    hinted: 'camera_attributes.cpp:295',
  }),
  dof_blur_near_enabled: v.boolean('dof_blur_near_enabled'),
  dof_blur_near_distance: v.float('dof_blur_near_distance', {
    min: 0.01,
    max: 8192,
    hinted: 'camera_attributes.cpp:297',
  }),
  dof_blur_near_transition: v.float('dof_blur_near_transition', {
    min: -1,
    max: 8192,
    hinted: 'camera_attributes.cpp:298',
  }),
  // camera_attributes.cpp:299
  dof_blur_amount: v.float('dof_blur_amount', { min: 0, max: 1, hinted: 'camera_attributes.cpp:299' }),
  // camera_attributes.cpp:302-303, both `or_greater`: floor only.
  auto_exposure_min_sensitivity: v.nonNegativeFloat('auto_exposure_min_sensitivity', {
    hinted: 'camera_attributes.cpp:302',
  }),
  auto_exposure_max_sensitivity: v.nonNegativeFloat('auto_exposure_max_sensitivity', {
    hinted: 'camera_attributes.cpp:303',
  }),
};

const physicalKeys: Record<string, PropertyValidator> = {
  // camera_attributes.cpp:487-488
  frustum_focus_distance: v.float('frustum_focus_distance', {
    min: 0.01,
    max: 4000,
    hinted: 'camera_attributes.cpp:487',
  }),
  frustum_focal_length: v.float('frustum_focal_length', {
    min: 1,
    max: 800,
    hinted: 'camera_attributes.cpp:488',
  }),
  // camera_attributes.cpp:489-490, both `or_greater`: floor only.
  frustum_near: v.float('frustum_near', { min: 0.001, hinted: 'camera_attributes.cpp:489' }),
  frustum_far: v.float('frustum_far', { min: 0.01, hinted: 'camera_attributes.cpp:490' }),
  // camera_attributes.cpp:493-494
  exposure_aperture: v.float('exposure_aperture', { min: 0.5, max: 64, hinted: 'camera_attributes.cpp:493' }),
  exposure_shutter_speed: v.float('exposure_shutter_speed', {
    min: 0.1,
    max: 8000,
    hinted: 'camera_attributes.cpp:494',
  }),
  // camera_attributes.cpp:497-498, both `or_greater`: floor only.
  auto_exposure_min_exposure_value: v.float('auto_exposure_min_exposure_value', {
    min: -16,
    hinted: 'camera_attributes.cpp:497',
  }),
  auto_exposure_max_exposure_value: v.float('auto_exposure_max_exposure_value', {
    min: -16,
    hinted: 'camera_attributes.cpp:498',
  }),
};

validatorRegistry.registerAll('CameraAttributes', baseKeys);
validatorRegistry.registerAll('CameraAttributesPractical', practicalKeys);
validatorRegistry.registerAll('CameraAttributesPhysical', physicalKeys);
