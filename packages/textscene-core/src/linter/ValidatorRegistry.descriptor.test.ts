/**
 * The registry answers a key no hand validator claims from the property descriptor, so a class
 * with no hand table still gets a check. A hand validator anywhere on the chain wins.
 */

import { describe, expect, it } from 'vitest';
import { ValidatorRegistry, validatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './propertyValidator.js';
import { CLASS_BASE_TYPES } from '../godot/classdb/classBaseTypes.js';
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

  it('builds a derived check once per type and key', () => {
    expect(validatorRegistry.declarationFor('BoxMesh', 'size')).toBe(
      validatorRegistry.declarationFor('BoxMesh', 'size')
    );
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

describe('a hand row', () => {
  /** Every captured class and key whose descriptor carries a hand row. */
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
    // Anti-vacuity: Camera3D and DirectionalLight3D register hand rows.
    expect(rows.length).toBeGreaterThan(7);
    const unread = rows.filter(({ type, key }) => !validatorRegistry.isDerived(type, key));
    expect(unread.map(({ type, key }) => `${type}.${key}`)).toEqual([]);
  });
});
