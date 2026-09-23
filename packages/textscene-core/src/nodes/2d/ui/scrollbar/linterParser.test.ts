/**
 * Tests that the ScrollBar validators reach its subclasses, through
 * `findValidator` on a real leaf: a tier that is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

const KEYS: string[] = ['custom_step'];
const LEAVES = ['HScrollBar', 'VScrollBar'] as const;

/** The error a validator returns for a value, or null when it accepts it. */
function check(nodeType: string, property: string, value: string) {
  const validator = validatorRegistry.findValidator(nodeType, property);
  expect(validator, `no validator reached ${nodeType}.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ScrollBar shared validators', () => {
  it('registers exactly what ScrollBar binds', () => {
    // An empty KEYS against an empty registerAll would pass vacuously.
    expect(validatorRegistry.getOwnKeys('ScrollBar')).not.toEqual([]);
    expect(validatorRegistry.getOwnKeys('ScrollBar').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it.each(LEAVES)('still reaches Range and Control keys past the tier on %s', (nodeType) => {
    expect(validatorRegistry.findValidator(nodeType, 'min_value')).not.toBeNull();
    expect(validatorRegistry.findValidator(nodeType, 'anchor_right')).not.toBeNull();
  });

  describe('custom_step', () => {
    it('accepts -1, the sentinel default that disables the override', () => {
      expect(check('HScrollBar', 'custom_step', '-1')).toBeNull();
    });

    it('accepts 4096, the top of the hint', () => {
      expect(check('HScrollBar', 'custom_step', '4096')).toBeNull();
    });

    it('rejects -2 as a WARNING, since only the hint states the bound', () => {
      const error = check('VScrollBar', 'custom_step', '-2');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });

    it('rejects 4097 as a WARNING, one past the hint ceiling', () => {
      const error = check('VScrollBar', 'custom_step', '4097');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });

    it('rejects a malformed value as an ERROR, from the format branch', () => {
      const error = check('HScrollBar', 'custom_step', 'abc');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });
  });
});
