import { describe, expect, it } from 'vitest';
import { classProperties, findClassProperty } from './classProperty';

describe('classProperty', () => {
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

  it('reads a class the pinned ClassDB lacks from its hand rows', () => {
    expect(findClassProperty('AreaLight3D', 'area_size')).toEqual({
      name: 'area_size',
      type: 5,
      hint: 5,
      hintString: 'suffix:m',
      declaredBy: 'AreaLight3D',
    });
  });

  it('marks a property ClassDB binds with no setter', () => {
    expect(findClassProperty('ShapeCast2D', 'collision_result')?.isSetterless).toBe(true);
    expect(findClassProperty('ShapeCast2D', 'margin')?.isSetterless).toBeUndefined();
  });
});
