// editor_properties.cpp:3764-3828

/** An end `or_less` or `or_greater` opens is absent. */
export interface RangeHintBounds {
  readonly min?: number;
  readonly max?: number;
  /** Also the deprecated `radians`. */
  readonly radiansAsDegrees: boolean;
}

/** editor_properties.cpp:3772 */
export function parseRangeHint(hintString: string): RangeHintBounds | undefined {
  const slices = hintString.split(',').map((slice) => slice.trim());
  if (slices.length < 2) return undefined;
  const flags = new Set(slices.slice(2));
  return {
    ...(flags.has('or_less') ? {} : { min: Number(slices[0]) }),
    ...(flags.has('or_greater') ? {} : { max: Number(slices[1]) }),
    radiansAsDegrees: flags.has('radians_as_degrees') || flags.has('radians'),
  };
}
