/**
 * The matchers for a diagnostic's tier, `toBeAtTier` for one and `toBeAllAtTier`
 * for a list. Each records the tier it asserts for the title check in
 * `titleTier.ts`. The setup file registers them.
 */

import type { MatcherState, SyncMatcherResult } from 'vitest';
import type { Severity } from '../types.js';
import { recordTier } from './titleTier.js';

/** A diagnostic, a `ParseError`, or the null a validator returns for an accepted value. */
type Tiered = { readonly severity: Severity; readonly message: string } | null | undefined;

/** The failure line for one tiered value: `[warning] <message>`, or `null`. */
export function describeTiered(tiered: Tiered): string {
  if (tiered === null || tiered === undefined) return String(tiered);
  return `[${tiered.severity}] ${tiered.message}`;
}

/** Record `tier` unless the matcher is negated: a tier ruled out is not a tier asserted. */
function recordUnlessNegated(state: MatcherState, tier: Severity): void {
  if (!state.isNot) recordTier(tier);
}

export function toBeAtTier(this: MatcherState, received: Tiered, tier: Severity): SyncMatcherResult {
  recordUnlessNegated(this, tier);
  return {
    pass: received?.severity === tier,
    message: () =>
      this.isNot
        ? `expected a diagnostic at any tier but ${tier}, got ${describeTiered(received)}`
        : `expected a diagnostic at ${tier}, got ${describeTiered(received)}`,
  };
}

/** Like `Array.every`, an empty list passes. */
export function toBeAllAtTier(
  this: MatcherState,
  received: readonly Tiered[],
  tier: Severity
): SyncMatcherResult {
  recordUnlessNegated(this, tier);
  const offenders = received.filter((tiered) => tiered?.severity !== tier);
  return {
    pass: offenders.length === 0,
    message: () =>
      this.isNot
        ? `expected a diagnostic at another tier than ${tier}, got ${received.length} at ${tier}`
        : `expected every diagnostic at ${tier}, got:\n  ${offenders.map(describeTiered).join('\n  ')}`,
  };
}

declare module 'vitest' {
  // An augmentation repeats vitest's own type parameters, used or not.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toBeAtTier(tier: Severity): R;
    toBeAllAtTier(tier: Severity): R;
  }
}
