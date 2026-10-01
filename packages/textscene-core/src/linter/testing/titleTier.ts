/**
 * The tiers the running test asserts, and the check that its title names no
 * other. Every helper that asserts a tier records it here, and the setup file's
 * `afterEach` checks the title against the record. A lint rule refuses the raw
 * `expect(d.severity)` spelling, which records nothing. It imports only types,
 * so any test file can load it.
 */

import type { Severity } from '../types.js';

/** Every tier word, and the prose that claims it. Total over `Severity`. */
const TIER_WORDS: Record<Severity, RegExp> = {
  error: /\b(?:errs?|errors?|errored|erroring)\b/i,
  warning: /\b(?:warns?|warned|warnings?)\b/i,
  info: /\binfos?\b/i,
};

/** Written by `recordTier`. `takeRecordedTiers` clears it, and the setup file takes it around each test. */
const recorded = new Set<Severity>();

/** Record that the running test asserts `tier`. A helper calls it for the tier it asserts, never a reported one. */
export function recordTier(tier: Severity): void {
  recorded.add(tier);
}

/** The tiers recorded since the last take, which this clears. */
export function takeRecordedTiers(): Severity[] {
  const tiers = [...recorded];
  recorded.clear();
  return tiers;
}

/**
 * Why `title` misstates the one tier its test asserts, or null when it does not. A
 * title that names the asserted tier may name another too, which admits "reports at
 * info, not error". A test that asserts two tiers or none is exempt, since its title
 * may name either.
 */
export function titleTierDrift(title: string, tiers: readonly Severity[]): string | null {
  if (tiers.length !== 1) return null;
  const asserted = tiers[0]!;
  if (TIER_WORDS[asserted].test(title)) return null;
  const named = (Object.keys(TIER_WORDS) as Severity[]).find((tier) => TIER_WORDS[tier].test(title));
  if (named === undefined) return null;
  return `the title "${title}" names ${named}, but the test asserts ${asserted}`;
}

/** Throw when `title` misstates the tiers recorded for its test, and clear the record. */
export function expectTitleNamesRecordedTiers(title: string): void {
  const drift = titleTierDrift(title, takeRecordedTiers());
  if (drift !== null) throw new Error(drift);
}
