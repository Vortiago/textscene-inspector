/**
 * The `FontFace` descriptors that hold a variable scene font at its `fvar` defaults, as Godot draws
 * it. Godot resets every axis to its default before it applies a variation
 * (`text_server_adv.cpp:1930-1933`), but Chromium maps the CSS weight `normal` (400) onto the `wght`
 * axis, so a font whose default is 300 draws a step too heavy without these.
 */

/** The ranges CSS accepts for `font-weight` and `font-stretch`. A descriptor outside them rejects `FontFace.load()`. */
const CSS_WEIGHT_RANGE = { min: 1, max: 1000 } as const;
const CSS_MIN_STRETCH_PERCENT = 0;

/**
 * `weight` and `stretch` are the route every engine honours, the VS Code floor of Chromium 114
 * included. `variationSettings` pins every axis, `opsz` too, where the engine reads it (Chrome 140+,
 * Firefox); an engine that does not ignores the member. Undefined for a font with no axes, which
 * registers with no descriptors.
 */
export function faceDescriptors(
  axisDefaults: Readonly<Record<string, number>>
): FontFaceDescriptors | undefined {
  const axes = Object.entries(axisDefaults);
  if (axes.length === 0) return undefined;

  const { wght, wdth } = axisDefaults;
  return {
    ...(wght !== undefined &&
      wght >= CSS_WEIGHT_RANGE.min &&
      wght <= CSS_WEIGHT_RANGE.max && { weight: String(wght) }),
    ...(wdth !== undefined && wdth >= CSS_MIN_STRETCH_PERCENT && { stretch: `${wdth}%` }),
    variationSettings: axes.map(([tag, value]) => `"${tag}" ${value}`).join(', '),
  };
}
