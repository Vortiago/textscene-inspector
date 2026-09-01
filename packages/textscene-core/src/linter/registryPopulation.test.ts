/**
 * The three populations, and the two things a sweep author gets wrong.
 *
 * Driven over SCRATCH registries wherever the claim is about the walk itself,
 * so a case cannot pass because the live registry happens to hold the right
 * shape — and over the live one only where the claim is about the live one.
 */

import { describe, it, expect } from 'vitest';
import { ValidatorRegistry } from './ValidatorRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './propertyValidator.js';
import { everyValidator, everyValidatorLabel, registeredKeys, registeredTypes } from './registryPopulation.js';
import './index.js'; // side-effect: every slice registers its validators

/** A validator that rejects nothing; the walk never calls it. */
const leaf = (): PropertyValidator => () => null;

const dispatcher = (leaves: PropertyValidator[]): PropertyValidator => {
  const v: PropertyValidator = () => null;
  v.leaves = leaves;
  return v;
};

describe('registeredTypes', () => {
  it('separates the two scopes, neither of which contains the other', () => {
    const registry = new ValidatorRegistry();
    registry.registerAll('Declares', { a: leaf() });
    registry.registerAll('Empty', {}); // legal and deliberate — CheckButton does this
    registry.registerUnavailable('RemovesOnly', {
      gone: { reason: 'the base takes it away', cite: 'box_container.cpp:1' },
    });

    expect(registeredTypes('declaring', registry)).toEqual(['Declares', 'Empty']);
    expect([...registeredTypes('answering', registry)].sort()).toEqual([
      'Declares',
      'Empty',
      'RemovesOnly',
    ]);
  });
});

describe('registeredKeys', () => {
  it('reaches a removal-only type, which the validator map never holds', () => {
    const registry = new ValidatorRegistry();
    registry.registerAll('Declares', { a: leaf() });
    registry.registerUnavailable('RemovesOnly', {
      gone: { reason: 'the base takes it away', cite: 'box_container.cpp:1' },
    });

    expect(registeredKeys(registry)).toEqual([
      { nodeType: 'Declares', key: 'a', kind: 'declaration' },
      { nodeType: 'RemovesOnly', key: 'gone', kind: 'removal' },
    ]);
  });
});

describe('everyValidator', () => {
  it('descends a dispatcher that `keep` itself rejects', () => {
    // The rule that was a comment inside one function: `keep` decides what is
    // REPORTED, never what is descended. Excusing a validator must not excuse
    // the subtree behind it.
    const kept = leaf();
    const root = dispatcher([kept]);
    const found = everyValidator((v) => v !== root, {
      roots: [{ label: 'Type.key/*', validator: root }],
    });
    expect(found.map((s) => s.label)).toEqual(['Type.key/*[0]']);
  });

  it('reports a leaf instance shared between dispatchers once', () => {
    const shared = leaf();
    const found = everyValidator(() => true, {
      roots: [
        { label: 'A.k/*', validator: dispatcher([shared]) },
        { label: 'B.k/*', validator: dispatcher([shared]) },
      ],
    });
    expect(found.filter((s) => s.depth === 1)).toHaveLength(1);
  });

  it('carries the registration at every depth, so no caller parses a label', () => {
    const nested = dispatcher([leaf()]);
    const found = everyValidator(() => true, {
      roots: [{ label: 'Type.settings/*', validator: dispatcher([nested]) }],
    });
    expect(found.map((s) => [s.label, s.nodeType, s.key, s.depth])).toEqual([
      ['Type.settings/*', 'Type', 'settings/*', 0],
      ['Type.settings/*[0]', 'Type', 'settings/*', 1],
      ['Type.settings/*[0][0]', 'Type', 'settings/*', 2],
    ]);
  });

  it('reports both removed keys when one type removes two for the same reason', () => {
    // `unavailableValidator` memoises on `nodeType\0reason\0cite` and NOT on the
    // key, so these two ARE one function. Identity dedupe would drop the second
    // label and the guard would never ask about it.
    const registry = new ValidatorRegistry();
    const reason = { reason: 'the base takes it away', cite: 'box_container.cpp:1' };
    registry.registerUnavailable('Twins', { first: reason, second: { ...reason } });

    const roots = registeredKeys(registry).map(({ nodeType, key, kind }) => ({
      label: `${nodeType}.${key}`,
      validator: registry.findValidator(nodeType, key)!,
      nodeType,
      key,
      kind,
    }));
    expect(roots[0]!.validator).toBe(roots[1]!.validator); // the memoisation, stated
    expect(everyValidatorLabel(() => true, { roots })).toEqual(['Twins.first', 'Twins.second']);
  });

  it('fails loudly below its floor rather than reporting an empty offender list', () => {
    expect(() => everyValidator(() => true, { roots: [], atLeast: 1 })).toThrow(/below the floor/);
  });

  it('walks the live registry past its roots, which is the whole point', () => {
    const all = everyValidator(() => true, { atLeast: 2000 });
    const roots = all.filter((s) => s.depth === 0).length;
    expect(all.length).toBeGreaterThan(roots);
    expect(all.filter((s) => s.depth >= 2).length).toBeGreaterThan(10);
    expect(registeredTypes('answering').length).toBeGreaterThan(
      registeredTypes('declaring').length
    );
    expect(validatorRegistry.getRegisteredNodeTypes().length).toBeGreaterThan(200);
  });
});
