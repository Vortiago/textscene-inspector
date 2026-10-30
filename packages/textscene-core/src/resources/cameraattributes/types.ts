/** A CameraAttributes resource as the renderer reads it (`scene/resources/camera_attributes.h:36-48`). */

export interface CameraAttributes {
  /**
   * `exposure_multiplier`, the scale of the whole frame. The previewer supports no physical light
   * units, so it is the whole exposure factor for both classes (`camera_attributes.cpp:56-64`).
   */
  exposureMultiplier: number;
  /** Null while `auto_exposure_enabled` is false. */
  autoExposure: AutoExposure | null;
}

/**
 * What an enabled auto exposure hands the renderer (`camera_attributes.cpp:247-255`, `:444-452`).
 * The frame's luminance settles on its average, held between the bounds, and the tonemap
 * divides the exposure by it over `scale`. The speed is absent: it paces the approach to that
 * luminance and leaves the settled frame as it is.
 */
export interface AutoExposure {
  /** `auto_exposure_scale`: the luminance that draws as the frame's own colours. */
  scale: number;
  minLuminance: number;
  maxLuminance: number;
}
