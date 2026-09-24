/**
 * The option bags the numeric combinators take: the bounds, plus the
 * {@link Grounding} that says which of them the engine actually enforces.
 */

import type { EnforcedEnd } from '../commonValidators.js';
import type { IntWidth } from '../../../godot/index.js';
import type { FiniteGrounding, Grounding } from './grounding.js';

/** The numbers alone, shared by both option bags. */
interface NumericBounds {
  /** Inclusive minimum. Omit for no lower bound. */
  min?: number;
  /** Inclusive maximum. Omit for no upper bound. */
  max?: number;
  /**
   * The setter's own floor, where it sits below `min`. Values under it error
   * whatever tier `min` reports at, and the band between reports at `min`'s
   * tier. `min` stays the hint's number, which the hint-parity ledger compares.
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
export interface IntOpts extends NumericBounds, Grounding {
  /**
   * The slot's C++ integer type, where the bounds do not imply it: a `uint32_t`
   * setter whose hint states no ceiling above `INT32_MAX` reads as int32.
   */
  width?: IntWidth;
}

export interface EnumOpts extends Grounding {
  /** Per-value display labels, such as `{0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'}`. */
  labels: Record<number, string>;
}
