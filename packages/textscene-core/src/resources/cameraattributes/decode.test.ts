/**
 * CameraAttributes resource decode: `CameraAttributesPractical` and `CameraAttributesPhysical`, which
 * share `exposure_multiplier` (`scene/resources/camera_attributes.cpp:128`) and the auto exposure
 * (`:130-133`). The luminance bounds are the ones each class hands the renderer
 * (`camera_attributes.cpp:247-255`, `:444-452`).
 */
import { describe, expect, it } from 'vitest';
import { decodeCameraAttributes } from './decode';

const PRACTICAL = 'CameraAttributesPractical';
const PHYSICAL = 'CameraAttributesPhysical';

describe('decodeCameraAttributes — the exposure multiplier', () => {
  it('reads an authored exposure_multiplier', () => {
    expect(decodeCameraAttributes(PRACTICAL, { exposure_multiplier: '2.5' }).exposureMultiplier).toBe(2.5);
  });

  it('defaults a bare resource to the multiplier 1', () => {
    expect(decodeCameraAttributes(PRACTICAL, {}).exposureMultiplier).toBe(1);
  });

  it('keeps a multiplier of 0, which darkens the frame to black', () => {
    expect(decodeCameraAttributes(PRACTICAL, { exposure_multiplier: '0' }).exposureMultiplier).toBe(0);
  });

  it('keeps a negative multiplier, which the setter does not clamp', () => {
    expect(decodeCameraAttributes(PRACTICAL, { exposure_multiplier: '-1.5' }).exposureMultiplier).toBe(-1.5);
  });

  it('reads an unreadable multiplier as the default', () => {
    expect(decodeCameraAttributes(PRACTICAL, { exposure_multiplier: 'bright' }).exposureMultiplier).toBe(1);
  });
});

describe('decodeCameraAttributes — the auto exposure', () => {
  it('is off for a bare resource and for auto_exposure_enabled = false', () => {
    expect(decodeCameraAttributes(PRACTICAL, {}).autoExposure).toBeNull();
    expect(decodeCameraAttributes(PRACTICAL, { auto_exposure_enabled: 'false' }).autoExposure).toBeNull();
  });

  it('turns a Practical resource on with Godot’s scale and ISO range', () => {
    // 0 and 800 ISO at the default sensitivity 100: ISO × (12.5 / 100) / 100.
    expect(decodeCameraAttributes(PRACTICAL, { auto_exposure_enabled: 'true' }).autoExposure).toEqual({
      scale: 0.4,
      minLuminance: 0,
      maxLuminance: 1,
    });
  });

  it('turns a Physical resource on with Godot’s scale and EV100 range', () => {
    // 2^-8 and 2^10 EV100 at the default sensitivity 100: 2^EV × 12.5 / 100.
    expect(decodeCameraAttributes(PHYSICAL, { auto_exposure_enabled: 'true' }).autoExposure).toEqual({
      scale: 0.4,
      minLuminance: 0.00048828125,
      maxLuminance: 128,
    });
  });

  it('converts an authored ISO range and scale for Practical', () => {
    expect(
      decodeCameraAttributes(PRACTICAL, {
        auto_exposure_enabled: 'true',
        auto_exposure_scale: '1.5',
        auto_exposure_min_sensitivity: '400',
        auto_exposure_max_sensitivity: '1600',
      }).autoExposure
    ).toEqual({ scale: 1.5, minLuminance: 0.5, maxLuminance: 2 });
  });

  it('converts an authored EV100 range for Physical', () => {
    expect(
      decodeCameraAttributes(PHYSICAL, {
        auto_exposure_enabled: 'true',
        auto_exposure_min_exposure_value: '-2',
        auto_exposure_max_exposure_value: '3',
      }).autoExposure
    ).toEqual({ scale: 0.4, minLuminance: 0.03125, maxLuminance: 1 });
  });

  it('ignores the range keys of the other class', () => {
    expect(
      decodeCameraAttributes(PRACTICAL, {
        auto_exposure_enabled: 'true',
        auto_exposure_min_exposure_value: '5',
      }).autoExposure
    ).toEqual({ scale: 0.4, minLuminance: 0, maxLuminance: 1 });
    expect(
      decodeCameraAttributes(PHYSICAL, {
        auto_exposure_enabled: 'true',
        auto_exposure_min_sensitivity: '400',
      }).autoExposure
    ).toEqual({ scale: 0.4, minLuminance: 0.00048828125, maxLuminance: 128 });
  });

  it('reads no speed: a still frame has settled whatever the speed', () => {
    const slow = decodeCameraAttributes(PRACTICAL, {
      auto_exposure_enabled: 'true',
      auto_exposure_speed: '0.01',
    });
    expect(slow.autoExposure).toEqual({ scale: 0.4, minLuminance: 0, maxLuminance: 1 });
  });

  it('keeps a negative bound and a scale of 0, which no setter clamps', () => {
    expect(
      decodeCameraAttributes(PRACTICAL, {
        auto_exposure_enabled: 'true',
        auto_exposure_scale: '0',
        auto_exposure_min_sensitivity: '-50',
      }).autoExposure
    ).toEqual({ scale: 0, minLuminance: -0.0625, maxLuminance: 1 });
  });

  it('keeps a minimum above the maximum, which the clamp resolves', () => {
    expect(
      decodeCameraAttributes(PRACTICAL, {
        auto_exposure_enabled: 'true',
        auto_exposure_min_sensitivity: '800',
        auto_exposure_max_sensitivity: '100',
      }).autoExposure
    ).toEqual({ scale: 0.4, minLuminance: 1, maxLuminance: 0.125 });
  });

  it('reads an unreadable scale as the default', () => {
    expect(
      decodeCameraAttributes(PRACTICAL, { auto_exposure_enabled: 'true', auto_exposure_scale: 'grey' })
        .autoExposure?.scale
    ).toBe(0.4);
  });
});

describe('decodeCameraAttributes — the sensitivity the luminance range converts with', () => {
  // `set_exposure_sensitivity` does not update the auto exposure (`camera_attributes.cpp:46-50`), so
  // only a sensitivity set before the last auto_exposure_* property reaches the range.
  it('converts with a sensitivity set before the auto exposure properties', () => {
    expect(
      decodeCameraAttributes(PRACTICAL, {
        exposure_sensitivity: '200',
        auto_exposure_enabled: 'true',
        auto_exposure_min_sensitivity: '400',
      }).autoExposure
    ).toEqual({ scale: 0.4, minLuminance: 0.25, maxLuminance: 0.5 });
  });

  it('converts a Physical range with it too', () => {
    expect(
      decodeCameraAttributes(PHYSICAL, {
        exposure_sensitivity: '200',
        auto_exposure_enabled: 'true',
        auto_exposure_min_exposure_value: '0',
        auto_exposure_max_exposure_value: '1',
      }).autoExposure
    ).toEqual({ scale: 0.4, minLuminance: 0.0625, maxLuminance: 0.125 });
  });

  it('keeps the default sensitivity when the property comes after the last auto exposure property', () => {
    expect(
      decodeCameraAttributes(PRACTICAL, {
        auto_exposure_enabled: 'true',
        auto_exposure_min_sensitivity: '400',
        exposure_sensitivity: '200',
      }).autoExposure
    ).toEqual({ scale: 0.4, minLuminance: 0.5, maxLuminance: 1 });
  });
});
