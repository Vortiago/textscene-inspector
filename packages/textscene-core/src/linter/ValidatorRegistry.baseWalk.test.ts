/**
 * How `findValidator` resolves a key: the base-class walk, the indexed-wildcard
 * routing that mirrors `PropertyListHelper`, and the members it must refuse to
 * resolve at all.
 *
 * A subclass with no validator of its own inherits its base type's validators,
 * so the single Node3D/Node2D/Control base validator sets reach every subclass
 * instead of silently passing. The walk is driven by an injected base-type map;
 * the registry defaults to no inheritance (empty map) and the singleton wires
 * the real NODE_BASE_TYPES.
 *
 * Every case here builds its own scratch registry, so nothing depends on the
 * barrel. The two guards that read the live singleton are the siblings
 * `ValidatorRegistry.unavailableKeys.test.ts` and
 * `ValidatorRegistry.shadowCopies.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { ValidatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './ValidatorRegistry.js';
import { v } from './validators/v.js';
import { propertyError } from './validators/propertyError.js';

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

describe('indexed wildcard routing mirrors the engine', () => {
  /**
   * Godot tests `is_valid_int()` BEFORE it looks at the value
   * (property_list_helper.cpp:52-58), so a signed index is a well-formed key that
   * the helper then refuses to resolve. Routing has to agree, or the dispatcher
   * that owns the negative-index diagnostic never runs and a key the engine
   * silently drops reads as clean.
   */
  function registryWithItems() {
    const r = new ValidatorRegistry();
    const seen: string[] = [];
    const dispatcher: PropertyValidator = (key, _value, line) => {
      seen.push(key);
      return propertyError(key, line, `dispatched ${key}`, 'DISPATCHED');
    };
    r.registerAll('Menu', { 'item_#/*': dispatcher });
    return { r, seen };
  }

  it('routes a NEGATIVE index to the dispatcher rather than dropping the key', () => {
    const { r, seen } = registryWithItems();
    expect(r.findValidator('Menu', 'item_-1/text')).not.toBeNull();
    r.findValidator('Menu', 'item_-1/text')!('item_-1/text', '"x"', 1);
    expect(seen).toContain('item_-1/text');
  });

  it('routes an explicitly POSITIVE index too, which is_valid_int also accepts', () => {
    const { r } = registryWithItems();
    expect(r.findValidator('Menu', 'item_+2/text')).not.toBeNull();
  });

  /**
   * A NON-NUMERIC index is the same case as a signed one, one step further on.
   * `PropertyListHelper::_get_property` returns nullptr when the index is not
   * `is_valid_int()` (property_list_helper.cpp:53-55), so `_set` returns false
   * and Godot DROPS the write. Routing has to deliver the key to the family's
   * dispatcher for that to be reportable at all: an unrouted `item_x/text`
   * reads as clean.
   *
   * A lone sign IS a valid index shape to route (the dispatcher decides), which
   * is why only the empty index below stays unrouted: with nothing between the
   * prefix and the slash there is no index text to report on.
   */
  it('routes a NON-NUMERIC index to the dispatcher, since Godot drops that write too', () => {
    const { r, seen } = registryWithItems();
    expect(r.findValidator('Menu', 'item_x/text')).not.toBeNull();
    r.findValidator('Menu', 'item_x/text')!('item_x/text', '"x"', 1);
    expect(seen).toContain('item_x/text');
  });

  it('routes a sign with no digits, which is_valid_int also refuses', () => {
    const { r } = registryWithItems();
    expect(r.findValidator('Menu', 'item_-/text')).not.toBeNull();
  });

  it('still refuses an EMPTY index, and a leaf below another slash', () => {
    const { r } = registryWithItems();
    expect(r.findValidator('Menu', 'item_/text')).toBeNull();
    // `#/*` addresses ONE leaf segment: `rsplit("/", true, 1)` puts
    // `item_0/deep` in the index half (property_list_helper.cpp:47), which is
    // not an index, so the helper never resolves it and no family owns it.
    expect(r.findValidator('Menu', 'item_0/deep/text')).toBeNull();
    expect(r.findValidator('Menu', 'item_x/deep/text')).toBeNull();
  });
});

describe('an inherited member name is not a validator', () => {
  it('does not resolve Object.prototype members as registered keys', () => {
    // `toString = 5` must not resolve Object.prototype.toString: it is truthy,
    // so the caller would push its return value into the diagnostic list in
    // place of a ParseError.
    const r = new ValidatorRegistry();
    r.registerAll('Thing', { real: v.boolean('real') });
    for (const inherited of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      expect(r.findValidator('Thing', inherited), inherited).toBeNull();
    }
    expect(r.findValidator('Thing', 'real')).not.toBeNull();
  });

  it('memoises a removal per citation, not just per reason', () => {
    // Two keys on one type can share wording and cite different guards; the
    // cached validator must not report the first one's file:line for both.
    const r = new ValidatorRegistry();
    r.registerUnavailable('Thing', {
      a: { reason: 'fixed by the class', cite: 'f.cpp:1' },
      b: { reason: 'fixed by the class', cite: 'f.cpp:2' },
    });
    expect(r.declarationFor('Thing', 'a')?.grounding?.cite).toBe('f.cpp:1');
    expect(r.declarationFor('Thing', 'b')?.grounding?.cite).toBe('f.cpp:2');
  });

  it('does not resolve them through a removal map either', () => {
    const r = new ValidatorRegistry();
    r.registerUnavailable('Thing', { gone: { reason: 'fixed by the class', cite: 'f.cpp:1' } });
    expect(r.findValidator('Thing', 'toString')).toBeNull();
    expect(r.findValidator('Thing', 'gone')).not.toBeNull();
  });
});
