/** Two float32 programs of the same text may round apart by a few ulp in each value they sum. */
const MAX_DIFFERENCE = 1e-5;

/** The largest difference between two read-backs of one size, with the index where it is. */
export function largestDifference(hand, lowered) {
  let largest = { difference: 0, index: -1 };
  for (let index = 0; index < hand.length; index += 1) {
    const difference = Math.abs(hand[index] - lowered[index]);
    if (!(difference <= largest.difference)) largest = { difference, index };
  }
  return largest;
}

/** One message for each stage whose lowered passes stray from the hand-written pass. */
export function computePassFailures(samples) {
  return Object.entries(samples).flatMap(([stage, { hand, lowered }]) => {
    const { difference, index } = largestDifference(hand, lowered);
    if (difference <= MAX_DIFFERENCE) return [];
    return [
      `${stage}: expected at most ${MAX_DIFFERENCE} from the hand pass, found ${difference} at value ${index}`,
    ];
  });
}
