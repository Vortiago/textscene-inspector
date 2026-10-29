/**
 * A lossless form of a baked texel table that gzip packs well. Each word, an integer bit pattern,
 * becomes its difference from a prediction: a smooth table leaves small residuals, which gzip packs
 * about three times tighter than base64 of the words. The generators write it, and the readers of
 * the DFG and LTC tables read it.
 */

/** How the words lie: `channels` words per texel, `width` texels per row. */
interface TableShape {
  width: number;
  channels: number;
}

/**
 * The prediction for the word at texel `x` of a row: the line through the two words before it, the
 * one word before it, or at a row start the word above it, which `rowStart` holds.
 */
function predicted(plane: readonly number[], at: number, x: number, rowStart: number): number {
  if (x === 0) return rowStart;
  if (x === 1) return plane[at - 1]!;
  return 2 * plane[at - 1]! - plane[at - 2]!;
}

/** The words of one channel, row by row. */
function planeOf(words: ArrayLike<number>, channel: number, channels: number): number[] {
  const plane: number[] = [];
  for (let i = channel; i < words.length; i += channels) plane.push(words[i]!);
  return plane;
}

/** The residuals of `words`, interleaved per texel: one plane per channel, each in row order. */
export function toResiduals(words: ArrayLike<number>, { width, channels }: TableShape): number[] {
  const residuals: number[] = [];
  for (let channel = 0; channel < channels; channel += 1) {
    const plane = planeOf(words, channel, channels);
    plane.forEach((word, at) => {
      const rowStart = at >= width ? plane[at - width]! : 0;
      residuals.push(word - predicted(plane, at, at % width, rowStart));
    });
  }
  return residuals;
}

/** The words `toResiduals` took, interleaved per texel again. */
export function fromResiduals(residuals: readonly number[], { width, channels }: TableShape): number[] {
  const texels = residuals.length / channels;
  const words = new Array<number>(residuals.length);
  for (let channel = 0; channel < channels; channel += 1) {
    const plane: number[] = [];
    for (let at = 0; at < texels; at += 1) {
      const rowStart = at >= width ? plane[at - width]! : 0;
      plane.push(residuals[channel * texels + at]! + predicted(plane, at, at % width, rowStart));
      words[at * channels + channel] = plane[at]!;
    }
  }
  return words;
}
