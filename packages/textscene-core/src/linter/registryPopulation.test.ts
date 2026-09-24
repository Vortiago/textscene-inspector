/**
 * The three populations, and the two things a sweep author gets wrong. A claim
 * about the walk runs over a scratch registry, so the live registry's shape
 * cannot pass it. Only a claim about the live registry runs over it.
 */

import { describe, it, expect } from 'vitest';
import { ValidatorRegistry, validatorRegistry } from './ValidatorRegistry.js';
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
    registry.registerAll('Empty', {}); // legal and deliberate: CheckButton does this
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
    // `keep` decides what is reported, never what is descended. Excusing a
    // validator must not excuse the subtree behind it.
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
      roots: [
        {
          label: 'Type.settings/*',
          validator: dispatcher([nested]),
          nodeType: 'Type',
          key: 'settings/*',
          kind: 'declaration',
        },
      ],
    });
    expect(found.map((s) => [s.label, s.nodeType, s.key, s.depth])).toEqual([
      ['Type.settings/*', 'Type', 'settings/*', 0],
      ['Type.settings/*[0]', 'Type', 'settings/*', 1],
      ['Type.settings/*[0][0]', 'Type', 'settings/*', 2],
    ]);
  });

  it('leaves the site empty for a fixture that names none, rather than guessing', () => {
    // The label is minted here; parsing it back would be the module inventing a
    // registration a scratch root never claimed.
    const [only] = everyValidator(() => true, {
      roots: [{ label: 'Guard.probe', validator: leaf() }],
    });
    expect([only!.nodeType, only!.key]).toEqual(['', '']);
  });

  it('reports both removed keys when one type removes two for the same reason', () => {
    // `unavailableValidator` memoises on `nodeType\0reason\0cite`, not on the
    // key, so these two are one function. Identity dedupe would drop the second
    // label.
    const registry = new ValidatorRegistry();
    const reason = { reason: 'the base takes it away', cite: 'box_container.cpp:1' };
    registry.registerUnavailable('Twins', { first: reason, second: { ...reason } });

    // Same reason and cite, so one function.
    expect(registry.declarationFor('Twins', 'first')).toBe(
      registry.declarationFor('Twins', 'second')
    );
    expect(everyValidatorLabel(() => true, { registry })).toEqual([
      'Twins.first',
      'Twins.second',
    ]);
  });

  it('reports a root whose validator was already reached as a leaf, in either order', () => {
    // One leaf function registered behind `<group>/*` and under `<group>/<leaf>`
    // is two registrations, so both get a depth-0 subject. Only the walk into
    // leaves dedupes.
    const shared = leaf();
    const group = {
      label: 'Type.group/*',
      validator: dispatcher([shared]),
      nodeType: 'Type',
      key: 'group/*',
      kind: 'declaration',
    } as const;
    const exact = {
      label: 'Type.group/leaf',
      validator: shared,
      nodeType: 'Type',
      key: 'group/leaf',
      kind: 'declaration',
    } as const;
    for (const roots of [[group, exact], [exact, group]]) {
      const found = everyValidator(() => true, { roots });
      expect(found.filter((s) => s.depth === 0).map((s) => s.label).sort()).toEqual([
        'Type.group/*',
        'Type.group/leaf',
      ]);
      expect(found.filter((s) => s.validator === shared && s.depth > 0).length).toBeLessThanOrEqual(1);
    }
  });

  it('yields a depth-0 subject for every registration the live registry resolves', () => {
    const registered = registeredKeys()
      .filter(({ nodeType, key }) => validatorRegistry.declarationFor(nodeType, key))
      .map(({ nodeType, key }) => `${nodeType}.${key}`)
      .sort();
    const roots = everyValidator(() => true)
      .filter((s) => s.depth === 0)
      .map((s) => s.label)
      .sort();
    expect(roots).toEqual(registered);
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
    expect(registeredTypes('declaring').length).toBeGreaterThan(200);
  });
});

describe('the wall itself, pinned at the type level', () => {
  it('hands back nothing to introspect from a lookup', () => {
    // Widening `findValidator` to `PropertyValidator` compiles the roots-only
    // population again with every call site green. `@ts-expect-error` fails
    // when the error it covers stops happening, so this test catches it.
    const validator = validatorRegistry.findValidator('Node2D', 'position');
    // @ts-expect-error a registry lookup is a ValidatorFn: it carries no tags.
    void validator?.accepts;
    // @ts-expect-error same, for the tag an int sweep filters on.
    void validator?.intSlot;

    // The tags are reachable through the declaration.
    expect(validatorRegistry.declarationFor('Node2D', 'position')?.accepts).toBeDefined();
  });
});
