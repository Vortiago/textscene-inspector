/** The measurement of a transpilation's image against Godot's: the pixels over 2/255, and the most. */

/** A difference of this many 8-bit steps or less is the residue of two rasterisers, not a defect. */
export const TOLERANCE_STEPS = 2;

/** The count of pixels whose largest channel difference passes the tolerance, and that difference. */
export function compareImages(godot, transpilation) {
  if (godot.length !== transpilation.length) {
    throw new Error(`expected images of one size, got ${godot.length} and ${transpilation.length} bytes`);
  }
  let overTolerance = 0;
  let maxSteps = 0;
  for (let pixel = 0; pixel < godot.length; pixel += 4) {
    let steps = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      steps = Math.max(steps, Math.abs(godot[pixel + channel] - transpilation[pixel + channel]));
    }
    if (steps > TOLERANCE_STEPS) overTolerance += 1;
    maxSteps = Math.max(maxSteps, steps);
  }
  return { pixels: godot.length / 4, overTolerance, maxSteps };
}
