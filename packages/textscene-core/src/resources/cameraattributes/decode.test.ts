/**
 * CameraAttributes resource decode: `CameraAttributesPractical` and `CameraAttributesPhysical`, which
 * share `exposure_multiplier` (`scene/resources/camera_attributes.cpp:128`).
 */
import { describe, expect, it } from 'vitest';
import { decodeCameraAttributes } from './decode';

describe('decodeCameraAttributes', () => {
  it('reads an authored exposure_multiplier', () => {
    expect(decodeCameraAttributes({ exposure_multiplier: '2.5' })).toEqual({ exposureMultiplier: 2.5 });
  });

  it('defaults a bare resource to the multiplier 1', () => {
    expect(decodeCameraAttributes({})).toEqual({ exposureMultiplier: 1 });
  });

  it('keeps a multiplier of 0, which darkens the frame to black', () => {
    expect(decodeCameraAttributes({ exposure_multiplier: '0' })).toEqual({ exposureMultiplier: 0 });
  });

  it('keeps a negative multiplier, which the setter does not clamp', () => {
    expect(decodeCameraAttributes({ exposure_multiplier: '-1.5' })).toEqual({ exposureMultiplier: -1.5 });
  });

  it('ignores the physical exposure_aperture and exposure_shutter_speed', () => {
    expect(
      decodeCameraAttributes({
        exposure_multiplier: '2',
        exposure_aperture: '4',
        exposure_shutter_speed: '30',
        exposure_sensitivity: '800',
      })
    ).toEqual({ exposureMultiplier: 2 });
  });

  it('reads an unreadable multiplier as the default', () => {
    expect(decodeCameraAttributes({ exposure_multiplier: 'bright' })).toEqual({ exposureMultiplier: 1 });
  });
});
