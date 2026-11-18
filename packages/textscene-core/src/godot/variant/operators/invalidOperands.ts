import { variant, type Variant } from '../value/variant.js';

/** An evaluator's `r_valid = false`, with the `r_ret` it leaves: Expression returns that value too. */
export class InvalidOperands {
  constructor(readonly value: Variant) {}
}

export const invalidWithText = (text: string) => new InvalidOperands(variant('STRING', text));
