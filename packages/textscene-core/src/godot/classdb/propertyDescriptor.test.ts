import { describe, expect, it } from 'vitest';
import { propertyDescriptor, registerPropertyFacts } from './propertyDescriptor';

describe('propertyDescriptor', () => {
  it('answers a class no slice registered, from the capture row', () => {
    expect(propertyDescriptor('BoxMesh', 'size')).toEqual({
      property: { name: 'size', type: 9, hint: 0, hintString: 'suffix:m', declaredBy: 'BoxMesh' },
      facts: undefined,
      cite: 'ClassDB 4.6.3: BoxMesh.size',
    });
  });

  it('finds an inherited property on the class that declares it', () => {
    expect(propertyDescriptor('BoxMesh', 'material')?.cite).toBe('ClassDB 4.6.3: PrimitiveMesh.material');
  });

  it('answers nothing for a key no class in the chain declares', () => {
    expect(propertyDescriptor('BoxMesh', 'not_a_property')).toBeUndefined();
  });

  it('answers nothing for a class whose rows are not from the capture', () => {
    expect(propertyDescriptor('AreaLight3D', 'area_range')).toBeUndefined();
  });

  it('carries the hand row a class registered, found along the base chain', () => {
    registerPropertyFacts('PrimitiveMesh', { flip_faces: { message: 'test message' } });
    expect(propertyDescriptor('BoxMesh', 'flip_faces')?.facts).toEqual({ message: 'test message' });
  });

  it('refuses a hand row for a key the capture does not hold', () => {
    expect(() => registerPropertyFacts('SphereMesh', { not_a_property: { message: 'm' } })).toThrow(
      "SphereMesh has no captured property 'not_a_property'"
    );
  });

  it('refuses a second hand row for the same key', () => {
    registerPropertyFacts('CapsuleMesh', { radius: { message: 'first' } });
    expect(() => registerPropertyFacts('CapsuleMesh', { radius: { message: 'second' } })).toThrow(
      "CapsuleMesh already has a hand row for 'radius'"
    );
  });
});
