import { compareImages, formatDelta, isSameImage } from '../visual/imageDelta.mjs';

/** The PNG bytes of a page's base64 capture. */
const pngOf = (base64) => Buffer.from(base64, 'base64');

/** One failure line when `actual` differs from `expected`, with the delta. */
export function sameImageFailures(name, expected, actual) {
  const delta = compareImages(pngOf(expected), pngOf(actual));
  if (isSameImage(delta)) return [];
  return [`${name}: ${formatDelta(delta)}`];
}

/** Whether two base64 captures are the same picture. */
export function isSameCapture(first, second) {
  return isSameImage(compareImages(pngOf(first), pngOf(second)));
}
