/** Recognises a value some solve handoff channel sealed, for the conformance guards. */
import { defineChannel } from './solveHandoff';

/** The seal mark, read off a probe value: the module keeps the symbol private, so nothing forges one. */
const [SEALED] = Object.getOwnPropertySymbols(defineChannel<null>('probe').seal(null));

/** Whether `value` was sealed by some channel. The conformance guard asserts it for every solved entry that carries one. */
export function isSealedHandoff(value: unknown): boolean {
  return typeof value === 'object' && value !== null && SEALED !== undefined && SEALED in value;
}
