import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

const check = (value: string) =>
  validatorRegistry.findValidator('OpenXRCompositionLayerCylinder', 'fallback_segments')!(
    'fallback_segments', value, 1
  );

describe('fallback_segments reads the slot the engine declares', () => {
  it('refuses exactly 0, the one value the guard names', () => {
    // ERR_FAIL_COND(p_fallback_segments == 0), openxr_composition_layer_cylinder.cpp:170
    expect(check('0')?.severity).toBe('error');
  });

  it('accepts a value above INT32_MAX, which the unsigned slot holds', () => {
    // Read at int32 this reported an alteration the uint32_t parameter never
    // makes.
    expect(check('4000000000')).toBeNull();
  });

  it('does not invent a floor of 1, which no engine line states', () => {
    // `PROPERTY_HINT_NONE` (:75) means there is no hint tier here, and the
    // setter names exactly one refused value. A negative literal narrows
    // through `Variant::operator uint32_t()` before the guard runs, so it is
    // stored rather than refused — the same reading every other uint32 slot in
    // this codebase gets, not a bound written for this property alone.
    const negative = check('-1');
    expect(negative?.message ?? '').not.toContain('>= 1');
  });
});
