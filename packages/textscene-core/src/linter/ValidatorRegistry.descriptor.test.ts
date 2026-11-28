import { describe, expect, it, vi } from 'vitest';
import { ValidatorRegistry, validatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './propertyValidator.js';
import { CLASS_BASE_TYPES, classBaseChain } from '../godot/classdb/classBaseTypes.js';
import { expectAccepted } from './testing/validatorCheck.js';
import { derivedValidator } from './descriptorValidator.js';
import { classProperties } from '../godot/classdb/classProperty.js';
import { propertyDescriptor } from '../godot/classdb/propertyDescriptor.js';
import {
  NODE_CLASS_PROPERTIES,
  RESOURCE_CLASS_PROPERTIES,
} from '../godot/classdb/classProperties.generated.js';
import './index.js'; // side-effect: every slice registers its validators

describe('the registry reads the property descriptor', () => {
  it.each([
    ['BoxMesh', 'size', '"abc"'],
    ['SphereMesh', 'radius', 'Vector3(1, 2, 3)'],
    ['Animation', 'length', '"long"'],
  ])('reports a format error on %s.%s = %s with no hand table for the class', (type, key, value) => {
    expect(validatorRegistry.getOwnKeys(type)).toEqual([]);
    const validator = validatorRegistry.findValidator(type, key);
    expect(validator, `no check for ${type}.${key}`).not.toBeNull();
    expect(validator!(key, value, 1)).toBeAtTier('error');
  });

  it('accepts the value Godot writes for the same property', () => {
    expectAccepted(validatorRegistry.findValidator('BoxMesh', 'size')!('size', 'Vector3(2, 1, 3)', 1));
  });

  it('answers nothing for a key no class in the chain declares', () => {
    expect(validatorRegistry.findValidator('BoxMesh', 'not_a_property')).toBeNull();
  });

  it('rebuilds a derived check when a hand row arrives after its first lookup', async () => {
    vi.resetModules();
    const { ValidatorRegistry } = await import('./ValidatorRegistry.js');
    const { derivedValidator } = await import('./descriptorValidator.js');
    const { registerPropertyFacts } = await import('../godot/classdb/propertyDescriptor.js');
    const registry = new ValidatorRegistry(CLASS_BASE_TYPES, derivedValidator);
    const frames = () => registry.findValidator('AnimatedTexture', 'frames')!('frames', '0', 1);
    expect(frames()).toBeAtTier('warning');
    registerPropertyFacts('AnimatedTexture', { frames: { setter: { cite: 'animated_texture.cpp:90' } } });
    expect(frames()).toBeAtTier('error');
  });

  it('builds a derived check once per type and key', () => {
    expect(validatorRegistry.declarationFor('BoxMesh', 'size')).toBe(
      validatorRegistry.declarationFor('BoxMesh', 'size')
    );
  });
});

describe('the base walk before the derivation', () => {
  // An ancestor's hand validator answers before a nearer capture row: right while no class repeats a key.
  it('meets no class that re-declares a key an ancestor captures', () => {
    const tables: Readonly<Record<string, readonly (readonly unknown[])[]>> = {
      ...NODE_CLASS_PROPERTIES,
      ...RESOURCE_CLASS_PROPERTIES,
    };
    const redeclared = Object.entries(tables).flatMap(([type, rows]) =>
      rows
        .filter(([name]) => classBaseChain(type).some((base) => tables[base]?.some((row) => row[0] === name)))
        .map(([name]) => `${type}.${String(name)}`)
    );
    expect(redeclared).toEqual([]);
  });
});

describe('a hand validator wins over the descriptor', () => {
  const hand: PropertyValidator = () => null;

  it('on the class itself', () => {
    const registry = new ValidatorRegistry(CLASS_BASE_TYPES, derivedValidator);
    registry.registerAll('BoxMesh', { size: hand });
    expect(registry.declarationFor('BoxMesh', 'size')).toBe(hand);
  });

  it('on a base class, though the descriptor answers for the class itself', () => {
    const registry = new ValidatorRegistry(CLASS_BASE_TYPES, derivedValidator);
    registry.registerAll('PrimitiveMesh', { material: hand });
    expect(registry.declarationFor('BoxMesh', 'material')).toBe(hand);
  });

  it('and a scratch registry reads no descriptor unless it is given the derivation', () => {
    expect(new ValidatorRegistry(CLASS_BASE_TYPES).declarationFor('BoxMesh', 'size')).toBeNull();
  });
});

describe('a wildcard for keys absent from ClassDB', () => {
  const captured: PropertyValidator = () => null;
  const fallback: PropertyValidator = Object.assign(() => null, { preferCaptured: true as const });
  const exact: PropertyValidator = () => null;

  function registry() {
    const registry = new ValidatorRegistry({ Child: 'Base' }, (_type, key) =>
      key === 'frame_0/x' ? captured : null
    );
    registry.registerAll('Child', { 'frame_#/*': fallback });
    return registry;
  }

  it('serves the concrete capture and uses the wildcard only for a miss', () => {
    const current = registry();
    expect(current.declarationFor('Child', 'frame_0/x')).toBe(captured);
    expect(current.isDerived('Child', 'frame_0/x')).toBe(true);
    expect(current.declarationFor('Child', 'frame_1/x')).toBe(fallback);
    expect(current.isDerived('Child', 'frame_1/x')).toBe(false);
  });

  it.each(['Child', 'Base'])('retains a hand declaration on %s', (type) => {
    const current = registry();
    current.registerAll(type, { 'frame_0/x': exact });
    expect(current.declarationFor('Child', 'frame_0/x')).toBe(exact);
    expect(current.isDerived('Child', 'frame_0/x')).toBe(false);
  });

  it('retains an inherited removal', () => {
    const current = registry();
    current.registerUnavailable('Base', { 'frame_0/x': { reason: 'dropped', cite: 'test.cpp:1' } });
    expect(current.findValidator('Child', 'frame_0/x')?.('frame_0/x', '1', 1)?.message).toContain('dropped');
  });
});

describe('a hand row', () => {
  function keysWithHandRows(): { type: string; key: string }[] {
    const types = [...Object.keys(NODE_CLASS_PROPERTIES), ...Object.keys(RESOURCE_CLASS_PROPERTIES)];
    return types.flatMap((type) =>
      classProperties(type)
        .filter(({ name }) => propertyDescriptor(type, name)?.facts !== undefined)
        .map(({ name }) => ({ type, key: name }))
    );
  }

  it('sits under no key a hand validator answers, where nothing would read it', () => {
    const rows = keysWithHandRows();
    expect(rows.length).toBeGreaterThan(7);
    const unread = rows.filter(({ type, key }) => !validatorRegistry.isDerived(type, key));
    expect(unread.map(({ type, key }) => `${type}.${key}`)).toEqual([]);
  });
});
