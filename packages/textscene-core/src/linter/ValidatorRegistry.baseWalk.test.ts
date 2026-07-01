/**
 * Base-class walk for `findValidator` (#143). A subclass with no validator of
 * its own inherits its base type's validators, so the single Node3D/Node2D/
 * Control base validator sets reach every subclass instead of silently passing.
 * The walk is driven by an injected base-type map; the registry defaults to no
 * inheritance (empty map) and the singleton wires the real NODE_BASE_TYPES.
 */

import { describe, it, expect } from 'vitest';
import { ValidatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './ValidatorRegistry.js';

// Child → Parent → Grandparent → (root). Grandparent has no further base.
const CHAIN = { Child: 'Parent', Parent: 'Grandparent' };

const baseVisible: PropertyValidator = () => null;
const ownTransform: PropertyValidator = () => null;

describe('ValidatorRegistry base-class walk', () => {
  it('finds a base-type validator for a subclass that registers none of its own', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Parent', { visible: baseVisible });
    expect(r.findValidator('Child', 'visible')).toBe(baseVisible);
  });

  it('walks multiple hops up the chain', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Grandparent', { visible: baseVisible });
    expect(r.findValidator('Child', 'visible')).toBe(baseVisible);
  });

  it('falls through to a base for a key the subclass does not cover', () => {
    // Child validates only `transform`; `visible` must still reach Parent.
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Child', { transform: ownTransform });
    r.registerAll('Parent', { visible: baseVisible });
    expect(r.findValidator('Child', 'transform')).toBe(ownTransform);
    expect(r.findValidator('Child', 'visible')).toBe(baseVisible);
  });

  it('prefers the subclass validator over an inherited one', () => {
    const own: PropertyValidator = () => null;
    const inherited: PropertyValidator = () => null;
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Child', { visible: own });
    r.registerAll('Parent', { visible: inherited });
    expect(r.findValidator('Child', 'visible')).toBe(own);
  });

  it('matches inherited wildcard patterns', () => {
    const wild: PropertyValidator = () => null;
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Parent', { 'theme_override_colors/*': wild });
    expect(r.findValidator('Child', 'theme_override_colors/font_color')).toBe(wild);
  });

  it('returns null when neither the type nor its bases validate the key', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Parent', { visible: baseVisible });
    expect(r.findValidator('Child', 'bogus')).toBeNull();
  });

  it('does not inherit when constructed without a base map (default = no inheritance)', () => {
    const r = new ValidatorRegistry();
    r.registerAll('Parent', { visible: baseVisible });
    expect(r.findValidator('Child', 'visible')).toBeNull();
  });

  it('terminates on a cyclic base map instead of looping forever', () => {
    const r = new ValidatorRegistry({ A: 'B', B: 'A' });
    r.registerAll('B', { visible: baseVisible });
    expect(r.findValidator('A', 'visible')).toBe(baseVisible);
    expect(r.findValidator('A', 'bogus')).toBeNull();
  });
});
