/**
 * The order the toolbar's error channels are set in. A counter taken when an error is set, not
 * render order: a fetch rejection can render after a later drop, and still be the older error.
 */

/** Written only by `nextErrorSequence`. It never clears: only the relative order is read. */
let lastErrorSequence = 0;

/** The next number in the one order every error channel shares. */
export function nextErrorSequence(): number {
  lastErrorSequence += 1;
  return lastErrorSequence;
}

/** One error a channel holds, with its place in the shared order. */
export interface SequencedError {
  readonly message: string;
  /** From `nextErrorSequence`, taken when the error is set. */
  readonly sequence: number;
}

/** `message` as the newest error, from `nextErrorSequence`. */
export function sequencedError(message: string): SequencedError {
  return { message, sequence: nextErrorSequence() };
}
