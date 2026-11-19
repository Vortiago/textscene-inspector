/** The cube draws about 6,000 pixels In-game. A blank canvas scores 0. */
export const INK_FLOOR = 2000;
/** The bar draws about 10,700 pixels at the stage's fit zoom, and the stage with no content about 1,000. */
export const INK_FLOOR_2D = 5000;
/** The cube at half scale draws about 2,100 fewer pixels in the 3D mode, beside its grid and sky. */
export const SHRUNK_INK_DROP = 1000;

function modeFailures(mode, { ink, canvases, isReplacedContextLost }, inkFloor) {
  return [
    ...(ink >= inkFloor ? [] : [`${mode}: expected at least ${inkFloor} drawn pixels, got ${ink}`]),
    ...(canvases === 1 ? [] : [`${mode}: expected one canvas in the element, got ${canvases}`]),
    ...(isReplacedContextLost
      ? []
      : [`${mode}: expected the replaced canvas to lose its context, got it live`]),
  ];
}

function hiddenWriteFailures({ before, hidden, shown }) {
  return [
    ...(hidden === before
      ? []
      : [`a write while hidden: expected the hidden view to keep its ${before} drawn pixels, got ${hidden}`]),
    ...(shown <= before - SHRUNK_INK_DROP
      ? []
      : [
          `a write while hidden: expected at most ${before - SHRUNK_INK_DROP} drawn pixels once shown, got ${shown}`,
        ]),
  ];
}

/** One line per failed check of the switched view, or none. */
export function switchFailures({ results, errors }) {
  return [
    ...(results.inGameInk >= INK_FLOOR
      ? []
      : [`In-game: expected at least ${INK_FLOOR} drawn pixels, got ${results.inGameInk}`]),
    ...(typeof results.hiddenCapture === 'number' && results.hiddenCapture > 0
      ? []
      : [`captureImage while hidden: expected a PNG, got ${results.hiddenCapture}`]),
    ...modeFailures('3D', results.modes['3D'], INK_FLOOR),
    ...modeFailures('2D', results.modes['2D'], INK_FLOOR_2D),
    ...hiddenWriteFailures(results.hiddenWrite),
    ...errors.map((message) => `page error: ${message}`),
  ].map((failure) => `update: ${failure}`);
}
