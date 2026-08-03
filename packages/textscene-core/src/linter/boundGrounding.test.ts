/**
 * Every numeric or enum bound must say where its authority comes from.
 *
 * ADR-0032: a bound is an ERROR only where Godot's setter refuses or alters the
 * value, and a WARNING where the property's `PROPERTY_HINT_RANGE` states it but
 * the setter assigns straight through. The `v` DSL records which, along with the
 * governing `file:line`, via `enforced:` / `hinted:`.
 *
 * A bound with neither is un-audited. It behaves as it always has (an error),
 * which is right for some and wrong for others, and the only way to know is to
 * read the setter. This is the ratchet over that migration: the count of
 * un-audited bounds goes down and never up, so a new slice cannot quietly add
 * one, and the number reaching zero is what finishes the audit.
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import { v } from './validators/v.js';
import './index.js'; // side-effect: every slice registers its validators

/**
 * How many bounded validators still carry no grounding.
 *
 * Lower this every time a family is audited. It must never rise: adding a bound
 * without `enforced:` or `hinted:` is what this exists to catch.
 */
const UNAUDITED_BOUND_BUDGET = 476;

interface BoundedKey {
  nodeType: string;
  key: string;
  grounded: boolean;
}

/** Every bounded validator in the registry, with whether it is grounded. */
function boundedKeys(): BoundedKey[] {
  const out: BoundedKey[] = [];
  for (const nodeType of validatorRegistry.getRegisteredNodeTypes()) {
    for (const key of validatorRegistry.getOwnKeys(nodeType)) {
      const validator = validatorRegistry.findValidator(nodeType, key);
      if (!validator?.bounded) continue;
      out.push({ nodeType, key, grounded: validator.grounding !== undefined });
    }
  }
  return out;
}

describe('bound grounding', () => {
  it('never lets the un-audited bound count rise', () => {
    const unaudited = boundedKeys().filter((b) => !b.grounded);
    expect(unaudited.length).toBeLessThanOrEqual(UNAUDITED_BOUND_BUDGET);
  });

  it('gives every grounded bound a source citation', () => {
    // The citation is the whole point: `enforced` without a `file:line` is the
    // same unverifiable claim the invented thresholds used to make.
    const uncited: string[] = [];
    for (const nodeType of validatorRegistry.getRegisteredNodeTypes()) {
      for (const key of validatorRegistry.getOwnKeys(nodeType)) {
        const g = validatorRegistry.findValidator(nodeType, key)?.grounding;
        if (g && !/\.(cpp|h):\d+/.test(g.cite)) uncited.push(`${nodeType}.${key}: "${g.cite}"`);
      }
    }
    expect(uncited.sort()).toEqual([]);
  });
});

describe('the two tiers behave differently', () => {
  it('an enforced bound rejects out-of-range as an error', () => {
    // Godot's own guard, so the value genuinely does not reach the engine.
    const validator = v.float('fov', { min: 1, max: 179, enforced: 'camera_3d.cpp:725' });
    expect(validator('fov', '250', 1)?.severity).toBe('error');
    expect(validator.grounding).toEqual({ kind: 'enforced', cite: 'camera_3d.cpp:725' });
  });

  it('a hinted bound reports out-of-range as a warning', () => {
    // The inspector will not offer it, but a .tscn carrying it loads and runs.
    const validator = v.float('near', { min: 0.001, hinted: 'camera_3d.cpp:685' });
    expect(validator('near', '0.0001', 1)?.severity).toBe('warning');
    expect(validator.grounding).toEqual({ kind: 'hinted', cite: 'camera_3d.cpp:685' });
  });

  it('keeps a FORMAT failure an error whatever the grounding', () => {
    // An unparseable value is malformed regardless of what Godot would accept.
    const validator = v.float('near', { min: 0.001, hinted: 'camera_3d.cpp:685' });
    expect(validator('near', 'not-a-number', 1)?.severity).toBe('error');
  });

  it('applies the same split to an enum', () => {
    const hinted = v.enumInt('mode', 0, 2, { 0: 'A', 1: 'B', 2: 'C' }, { hinted: 'x.cpp:10' });
    expect(hinted('mode', '9', 1)?.severity).toBe('warning');
    const enforced = v.enumInt('mode', 0, 2, { 0: 'A', 1: 'B', 2: 'C' }, { enforced: 'x.cpp:11' });
    expect(enforced('mode', '9', 1)?.severity).toBe('error');
  });

  it('leaves an un-audited bound erroring, as it did before the split', () => {
    const validator = v.float('legacy', { min: 0 });
    expect(validator('legacy', '-1', 1)?.severity).toBe('error');
    expect(validator.grounding).toBeUndefined();
  });
});
