/**
 * A lossless form of a baked texel table that gzip packs well. Each word, an integer bit pattern,
 * becomes its difference from a prediction: a smooth table leaves small residuals, which gzip packs
 * about three times tighter than base64 of the words. The generators write it, and the readers of
 * the DFG and LTC tables read it.
 */

/** How the words lie: `channels` words per texel, `width` texels per row. */
export interface TableShape {
  width: number;
  channels: number;
}

/**
 * The prediction for word `at` of a channel's plane, which `wordAt` reads in row order: the line
 * through the two words before it in its row, the one word before it, or at a row start the word
 * above it.
 */
function predicted(wordAt: (at: number) => number, at: number, width: number): number {
  const x = at % width;
  if (x === 0) return at >= width ? wordAt(at - width) : 0;
  if (x === 1) return wordAt(at - 1);
  return 2 * wordAt(at - 1) - wordAt(at - 2);
}

/** The residuals of `words`, interleaved per texel: one plane per channel, each in row order. */
export function toResiduals(words: ArrayLike<number>, { width, channels }: TableShape): number[] {
  const residuals: number[] = [];
  const texels = words.length / channels;
  for (let channel = 0; channel < channels; channel += 1) {
    const wordAt = (at: number) => words[at * channels + channel]!;
    for (let at = 0; at < texels; at += 1) residuals.push(wordAt(at) - predicted(wordAt, at, width));
  }
  return residuals;
}

/** Writes the words `toResiduals` took into `words`, interleaved per texel again, and returns it. */
export function fromResiduals<Words extends Uint16Array | Uint32Array>(
  residuals: readonly number[],
  { width, channels }: TableShape,
  words: Words
): Words {
  const texels = residuals.length / channels;
  for (let channel = 0; channel < channels; channel += 1) {
    const wordAt = (at: number) => words[at * channels + channel]!;
    for (let at = 0; at < texels; at += 1) {
      words[at * channels + channel] = residuals[channel * texels + at]! + predicted(wordAt, at, width);
    }
  }
  return words;
}
