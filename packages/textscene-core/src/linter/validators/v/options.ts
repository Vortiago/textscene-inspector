/**
 * The option bags the numeric combinators take: the bounds, plus the
 * {@link Grounding} that says which of them the engine actually enforces.
 */

import type { Grounding } from './grounding.js';

export interface FloatOpts extends Grounding {
  /** Inclusive minimum. Omit for no lower bound. */
  min?: number;
  /** Inclusive maximum. Omit for no upper bound. */
  max?: number;
  /** Custom range message override (replaces the auto-derived "must be …" text). */
  message?: string;
}

/** Same shape as `FloatOpts`; named separately for documentation symmetry. */
export type IntOpts = FloatOpts;

export interface EnumOpts extends Grounding {
  /** Per-value display labels, e.g. `{0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'}`. */
  labels: Record<number, string>;
}
