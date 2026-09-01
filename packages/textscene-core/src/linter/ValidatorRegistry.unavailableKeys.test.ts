/**
 * `registerUnavailable`: a leaf taking a key AWAY from its base chain.
 *
 * Narrowing is not the same as re-declaring. A fixed-orientation container
 * cannot carry `vertical` at all, so the key needs a rejection that fires
 * whatever the value, stops at a descendant that puts the key back, and reports
 * the same reach through `getUnavailableKeys` (which feeds the generated sheet)
 * as through `findValidator` (which feeds the linter).
 */

import { describe, it, expect } from 'vitest';
import { ValidatorRegistry, validatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './ValidatorRegistry.js';
import './index.js'; // trigger all validator registrations

describe('ValidatorRegistry.registerUnavailable', () => {
  const CHAIN = { Leaf: 'Mid', Mid: 'Root' };
  const ok: PropertyValidator = () => null;

  it('rejects every value for a key the leaf removes, naming the reason', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Leaf', {
      vertical: { reason: 'its orientation is fixed', cite: 'box_container.cpp:312' },
    });
    const diagnostic = r.findValidator('Leaf', 'vertical')!('vertical', 'true', 7);
    expect(diagnostic?.code).toBe('UNAVAILABLE_VERTICAL');
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.message).toContain('cannot be set on Leaf');
    expect(diagnostic?.message).toContain('its orientation is fixed');
  });

  it('rejects the key whatever the value, since presence is the defect', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Leaf', { vertical: { reason: 'fixed', cite: 'box_container.cpp:312' } });
    const validator = r.findValidator('Leaf', 'vertical')!;
    for (const value of ['true', 'false', '', 'garbage']) {
      expect(validator('vertical', value, 1)).not.toBeNull();
    }
  });

  it('leaves siblings and the declaring base untouched', () => {
    const r = new ValidatorRegistry({ ...CHAIN, Other: 'Root' });
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Leaf', { vertical: { reason: 'fixed', cite: 'box_container.cpp:312' } });
    expect(r.findValidator('Other', 'vertical')).toBe(ok);
    expect(r.findValidator('Root', 'vertical')).toBe(ok);
  });

  it('does not count a removal as a declared key', () => {
    // getOwnKeys feeds the shadow guard and the sheet's own-property table; a
    // removal is neither a declaration nor a shadow.
    const r = new ValidatorRegistry(CHAIN);
    r.registerUnavailable('Leaf', { vertical: { reason: 'fixed', cite: 'box_container.cpp:312' } });
    expect(r.getOwnKeys('Leaf')).toEqual([]);
    expect(r.getUnavailableKeys('Leaf')).toEqual(['vertical']);
  });

  it('stops at a descendant that re-declares the key', () => {
    // Mid removes it, but Leaf validates it again, so Leaf can carry it.
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Mid', { vertical: { reason: 'fixed', cite: 'box_container.cpp:312' } });
    r.registerAll('Leaf', { vertical: ok });
    expect(r.findValidator('Leaf', 'vertical')).toBe(ok);
    expect(r.declarationFor('Mid', 'vertical')?.accepts).toBe('not available on this type');
  });

  it('reports the same reach through getUnavailableKeys as through findValidator', () => {
    // The two answer one question, for the linter and for the generated sheet.
    // While they disagreed, a key re-declared by a descendant was still listed
    // as unavailable in that descendant's sheet, contradicting the linter that
    // had just accepted it.
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Mid', { vertical: { reason: 'fixed', cite: 'box_container.cpp:312' } });
    r.registerAll('Leaf', { vertical: ok });
    expect(r.getUnavailableKeys('Leaf')).toEqual([]);
    expect(r.getUnavailableKeys('Mid')).toEqual(['vertical']);
  });

  it('keeps a key removed by the same type that declares it', () => {
    // Ordering within a hop: findValidator checks the removal first, so a type
    // both removing and declaring a key reports it removed. getUnavailableKeys
    // must agree rather than letting the declaration cancel the removal.
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Leaf', { vertical: ok });
    r.registerUnavailable('Leaf', { vertical: { reason: 'fixed', cite: 'box_container.cpp:312' } });
    expect(r.declarationFor('Leaf', 'vertical')?.accepts).toBe('not available on this type');
    expect(r.getUnavailableKeys('Leaf')).toEqual(['vertical']);
  });

  it('is cleared with the validators', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerUnavailable('Leaf', { vertical: { reason: 'fixed', cite: 'box_container.cpp:312' } });
    r.clear();
    expect(r.findValidator('Leaf', 'vertical')).toBeNull();
  });

  it('refuses `vertical` on all four fixed-orientation containers, and allows it on their bases', () => {
    for (const fixed of ['HBoxContainer', 'VBoxContainer', 'HSplitContainer', 'VSplitContainer']) {
      const diagnostic = validatorRegistry.findValidator(fixed, 'vertical')!('vertical', 'true', 1);
      expect(diagnostic?.code, fixed).toBe('UNAVAILABLE_VERTICAL');
      expect(validatorRegistry.getOwnKeys(fixed), fixed).toEqual([]);
    }
    for (const base of ['BoxContainer', 'SplitContainer']) {
      expect(validatorRegistry.findValidator(base, 'vertical')!('vertical', 'true', 1)).toBeNull();
    }
  });
});
