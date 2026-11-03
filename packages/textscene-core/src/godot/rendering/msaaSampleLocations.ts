/**
 * Where each sample of a multisampled pixel sits: Vulkan's standard sample locations, which Godot's
 * Vulkan renderer draws at, in sample order, as fractions of the pixel from its top-left corner
 * (Vulkan specification, "Standard Sample Locations").
 */

export interface SampleLocation {
  x: number;
  y: number;
}

const STANDARD_LOCATIONS: Record<number, readonly SampleLocation[]> = {
  2: [
    { x: 0.75, y: 0.75 },
    { x: 0.25, y: 0.25 },
  ],
  4: [
    { x: 0.375, y: 0.125 },
    { x: 0.875, y: 0.375 },
    { x: 0.125, y: 0.625 },
    { x: 0.625, y: 0.875 },
  ],
  8: [
    { x: 0.5625, y: 0.3125 },
    { x: 0.4375, y: 0.6875 },
    { x: 0.8125, y: 0.5625 },
    { x: 0.3125, y: 0.1875 },
    { x: 0.1875, y: 0.8125 },
    { x: 0.0625, y: 0.4375 },
    { x: 0.6875, y: 0.9375 },
    { x: 0.9375, y: 0.0625 },
  ],
};

const PIXEL_CENTRE: readonly SampleLocation[] = [{ x: 0.5, y: 0.5 }];

/** The locations of `samples` samples a pixel, from three's count: 0 is one sample at the centre. */
export function standardSampleLocations(samples: number): readonly SampleLocation[] {
  return STANDARD_LOCATIONS[samples] ?? PIXEL_CENTRE;
}

/**
 * The NDC offset that moves a frame `width` by `height` so each pixel's centre samples the scene at
 * `location`. NDC's y runs up, a location's down.
 */
export function sampleJitter(location: SampleLocation, width: number, height: number): SampleLocation {
  return { x: ((0.5 - location.x) * 2) / width, y: ((location.y - 0.5) * 2) / height };
}
