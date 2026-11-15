/**
 * The bounds of a `PROPERTY_HINT_RANGE` hint string, read the way `_parse_range_hint` reads them
 * (`editor_properties.cpp:3764-3828`): the first two slices are the ends, and the flags after them
 * may open an end or say the stored radians show as degrees.
 */

/** The ends a range hint closes. An end that `or_less` or `or_greater` opens is absent. */
export interface RangeHintBounds {
  readonly min?: number;
  readonly max?: number;
  /** `radians_as_degrees`, or the deprecated `radians`: the ends are degrees, the value radians. */
  readonly radiansAsDegrees: boolean;
}

/** The bounds of `hintString`, or undefined where it has no two ends (`editor_properties.cpp:3772`). */
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
