import { UnrepresentableArray } from '../../variant/call/arrayLength.js';
import { UnportedMethod } from '../../variant/call/unportedMethod.js';

/** A decoder's throw that is no refused stream: a decoder not lent, or output past what V8 holds. */
export function rethrowUnportable(error: unknown): void {
  if (error instanceof UnportedMethod) throw error;
  if (error instanceof RangeError)
    throw new UnrepresentableArray(`decompress output past what V8 holds: ${error.message}`);
}
