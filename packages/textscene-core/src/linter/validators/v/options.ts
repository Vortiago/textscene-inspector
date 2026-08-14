/**
 * The option bags the numeric combinators take: the bounds, plus the
 * {@link Grounding} that says which of them the engine actually enforces.
 */

import type { EnforcedEnd } from '../commonValidators.js';
import type { FiniteGrounding, Grounding } from './grounding.js';

/** The numbers alone, shared by both option bags. */
interface NumericBounds {
  /** Inclusive minimum. Omit for no lower bound. */
  min?: number;
  /** Inclusive maximum. Omit for no upper bound. */
  max?: number;
  /**
   * The setter's own floor, where it sits BELOW `min`. Values under it are an
   * ERROR whatever tier `min` reports at, and the band between the two still
   * reports at `min`'s tier, so a property refused at `<= 0` and hinted from
   * 0.01 says the right thing about both 0 and 0.005.
   *
   * `min` stays the number the hint states, which is what the hint-parity
   * ledger compares against the engine's captured `PROPERTY_HINT_RANGE`.
   */
  enforcedMin?: EnforcedEnd;
  /** The setter's own ceiling, where it sits above `max`. */
  enforcedMax?: EnforcedEnd;
  /** Custom range message override (replaces the auto-derived "must be …" text). */
  message?: string;
}

/** The bounds plus a grounding that may cite an `is_finite` guard. */
export interface FloatOpts extends NumericBounds, FiniteGrounding {}

/**
 * The same bounds, without `finite`: an INT slot cannot hold a non-finite in
 * the first place, so no int setter has an `is_finite` guard to cite.
 */
export interface IntOpts extends NumericBounds, Grounding {}

export interface EnumOpts extends Grounding {
  /** Per-value display labels, e.g. `{0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'}`. */
  labels: Record<number, string>;
}
