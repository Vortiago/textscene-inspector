/** A CameraAttributes resource as the renderer reads it (`scene/resources/camera_attributes.h:36-48`). */

export interface CameraAttributes {
  /**
   * `exposure_multiplier`, the scale of the whole frame. The previewer supports no physical light
   * units, so it is the whole exposure normalisation factor for both classes (`camera_attributes.cpp:56-64`).
   */
  exposureMultiplier: number;
}
