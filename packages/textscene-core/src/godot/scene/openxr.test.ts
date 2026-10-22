import { describe, it, expect } from 'vitest';
import {
  COMPOSITION_FILTER_NAMES,
  COMPOSITION_MIPMAP_MODE_NAMES,
  COMPOSITION_SWIZZLE_NAMES,
  COMPOSITION_WRAP_NAMES,
  HAND_BONE_UPDATE_NAMES,
  OPEN_XR_HAND_NAMES,
  MOTION_RANGE_NAMES,
  RENDER_MODEL_TRACKER_NAMES,
  SKELETON_RIG_NAMES,
} from './openxr.js';

describe('OpenXRCompositionLayer swapchain names', () => {
  it('names each filter by its constant', () => {
    expect(COMPOSITION_FILTER_NAMES).toEqual({ 0: 'NEAREST', 1: 'LINEAR', 2: 'CUBIC' });
  });

  it('names each mipmap mode by its constant', () => {
    expect(COMPOSITION_MIPMAP_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'NEAREST', 2: 'LINEAR' });
  });

  it('names each wrap mode by its constant', () => {
    expect(COMPOSITION_WRAP_NAMES).toEqual({
      0: 'CLAMP_TO_BORDER',
      1: 'CLAMP_TO_EDGE',
      2: 'REPEAT',
      3: 'MIRRORED_REPEAT',
      4: 'MIRROR_CLAMP_TO_EDGE',
    });
  });

  it('names each swizzle by its constant', () => {
    expect(COMPOSITION_SWIZZLE_NAMES).toEqual({
      0: 'RED',
      1: 'GREEN',
      2: 'BLUE',
      3: 'ALPHA',
      4: 'ZERO',
      5: 'ONE',
    });
  });
});

describe('OpenXRHand names', () => {
  it('names each hand as `openxr_hand.cpp:55` hints it', () => {
    expect(OPEN_XR_HAND_NAMES).toEqual({ 0: 'Left', 1: 'Right' });
  });

  it('names each motion range as `openxr_hand.cpp:56` hints it', () => {
    expect(MOTION_RANGE_NAMES).toEqual({ 0: 'Unobstructed', 1: 'Conform to controller' });
  });

  it('names each skeleton rig as `openxr_hand.cpp:58` hints it', () => {
    expect(SKELETON_RIG_NAMES).toEqual({ 0: 'OpenXR', 1: 'Humanoid' });
  });

  it('names each bone update mode as `openxr_hand.cpp:59` hints it', () => {
    expect(HAND_BONE_UPDATE_NAMES).toEqual({ 0: 'Full', 1: 'Rotation Only' });
  });
});

describe('OpenXRRenderModelManager names', () => {
  it('names each tracker as `openxr_render_model_manager.cpp:44` hints it', () => {
    expect(RENDER_MODEL_TRACKER_NAMES).toEqual({
      0: 'Any',
      1: 'None set',
      2: 'Left Hand',
      3: 'Right Hand',
    });
  });
});
