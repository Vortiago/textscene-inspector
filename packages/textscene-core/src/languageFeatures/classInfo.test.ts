import { describe, expect, it } from 'vitest';
import {
  classProperties,
  findClassProperty,
  isKnownClass,
  nodeClassNames,
  resourceClassNames,
} from './classInfo';

describe('classInfo', () => {
  it('names the class nearest the queried type that declares a property', () => {
    const properties = classProperties('MeshInstance3D');
    const mesh = properties.find((property) => property.name === 'mesh');
    const visible = properties.find((property) => property.name === 'visible');
    expect(mesh?.declaredBy).toBe('MeshInstance3D');
    expect(visible?.declaredBy).toBe('Node3D');
  });

  it('resolves an inherited property with its Variant type and hint', () => {
    const property = findClassProperty('MeshInstance3D', 'mesh');
    expect(property).toMatchObject({ type: 24, hint: 17, hintString: 'Mesh', declaredBy: 'MeshInstance3D' });
  });

  it('returns undefined for a property no class in the chain declares', () => {
    expect(findClassProperty('MeshInstance3D', 'not_a_property')).toBeUndefined();
  });

  it('knows a node class, a resource class and neither for an invented name', () => {
    expect(isKnownClass('MeshInstance3D')).toBe(true);
    expect(isKnownClass('BoxMesh')).toBe(true);
    expect(isKnownClass('NotAClass')).toBe(false);
  });

  it('offers every node and resource class a scene may name', () => {
    expect(nodeClassNames()).toContain('MeshInstance3D');
    expect(nodeClassNames()).toContain('Node');
    expect(resourceClassNames()).toContain('BoxMesh');
    expect(resourceClassNames()).toContain('Resource');
  });
});
