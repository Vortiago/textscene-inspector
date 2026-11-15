/**
 * The two causes of a difference in a call of constants that glslang leaves to the GPU (`sinh`,
 * `cosh`, `tanh`, `asinh`, `acosh`, `atanh`, `inverse` and the other calls `Constant.cpp` does not
 * fold), and the side whose compiler folds the call. The probe pairs of `foldedCallProbes.mjs`
 * prove the side: the probe of a parameter gives the GPU's value on both sides.
 */

export const GODOT_DRIVER = "Godot's driver";
export const BROWSER_COMPILER = "the browser's compiler";
export const BOTH_SIDES = 'both sides, to other values';

/** Inside the call's domain: the fold differs from the GPU in the last bits. */
export const DRIVER_ROUNDED_CALL = {
  owner: '#1826',
  cause: "a call glslang leaves to the GPU, which one side's compiler folds to other last bits",
};

/**
 * Outside the call's domain, or near the float range: the browser's compiler folds the call to a
 * number, such as 0 for `atanh(92.167)`, where the GPU gives NaN or infinity.
 */
export const DRIVER_EDGE_CALL = {
  owner: '#1826',
  cause:
    "a call glslang leaves to the GPU, outside its domain or near the float range, which the browser's compiler folds to a number",
  folds: BROWSER_COMPILER,
};

export const DRIVER_NAN_MIX = {
  owner: '#1826',
  cause:
    "a mix of a NaN with a weight of 1, which Godot's driver folds to NaN and the GPU gives as the second value",
  folds: GODOT_DRIVER,
};
