/** The cube draws about 6,000 pixels In-game. A blank canvas scores 0. */
export const CUBE_INK_FLOOR = 2000;
/** The bar draws about 10,700 pixels at the stage's fit zoom, and the stage with no content about 1,000. */
export const BAR_INK_FLOOR = 5000;
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

/** A hidden view draws the frames that settle a write, and showing it again draws nothing new. */
function hiddenWriteFailures({ before, hidden, shown }) {
  return [
    ...(hidden <= before - SHRUNK_INK_DROP
      ? []
      : [
          `a write while hidden: expected at most ${before - SHRUNK_INK_DROP} drawn pixels once it settles, got ${hidden}`,
        ]),
    ...(shown === hidden
      ? []
      : [`a write while hidden: expected the shown view to keep its ${hidden} drawn pixels, got ${shown}`]),
  ];
}

function freshMountFailures(changedFromFreshMount) {
  return Object.entries(changedFromFreshMount)
    .filter(([, changed]) => changed !== 0)
    .map(
      ([mode, changed]) =>
        `${mode} after a switch: expected the frame of a fresh mount, got ${changed} changed pixels`
    );
}

function captureFailures(capturedVsShown) {
  return Object.entries(capturedVsShown).flatMap(([mode, delta]) => {
    if (delta.changedPixels === 0) return [];
    const found =
      delta.changedPixels === undefined
        ? `a ${delta.actual.width} x ${delta.actual.height} PNG for a ${delta.expected.width} x ${delta.expected.height} view`
        : `${delta.changedPixels} changed pixels, at most ${delta.maxChannelDelta}/255`;
    return [`captureImage in ${mode}: expected the pixels the view shows, got ${found}`];
  });
}

/** One line per failed check of the switched view, or none. */
export function switchFailures({ results, errors }) {
  return [
    ...(results.inGameInk >= CUBE_INK_FLOOR
      ? []
      : [`In-game: expected at least ${CUBE_INK_FLOOR} drawn pixels, got ${results.inGameInk}`]),
    ...(typeof results.hiddenCapture === 'number' && results.hiddenCapture > 0
      ? []
      : [`captureImage while hidden: expected a PNG, got ${results.hiddenCapture}`]),
    ...modeFailures('3D', results.modes['3D'], CUBE_INK_FLOOR),
    ...modeFailures('2D', results.modes['2D'], BAR_INK_FLOOR),
    ...modeFailures('In-game again', results.modes['in-game'], CUBE_INK_FLOOR),
    ...freshMountFailures(results.changedFromFreshMount),
    ...captureFailures(results.capturedVsShown),
    ...(results.changedFromFirstInGame > 0
      ? []
      : [
          'a write before a switch: expected the In-game frame after the switches to differ from the first, got the same',
        ]),
    ...hiddenWriteFailures(results.hiddenWrite),
    ...errors.map((message) => `page error: ${message}`),
  ].map((failure) => `update: ${failure}`);
}
