import { describe, expect, it } from 'vitest';
import { internMaterial, type CsgMaterialAddress } from './csgMaterials';

describe('internMaterial', () => {
  it('appends a new address and answers its slot', () => {
    const materials: CsgMaterialAddress[] = ['SubResource("Red")'];
    expect(internMaterial(materials, 'res://rock.tres::Mat')).toBe(1);
    expect(materials).toEqual(['SubResource("Red")', 'res://rock.tres::Mat']);
  });

  it('answers the existing slot for an address it holds, adding nothing', () => {
    const materials: CsgMaterialAddress[] = ['SubResource("Red")', 'SubResource("Green")'];
    expect(internMaterial(materials, 'SubResource("Green")')).toBe(1);
    expect(materials).toHaveLength(2);
  });

  it('interns no material as a slot of its own (edge case)', () => {
    const materials: CsgMaterialAddress[] = [];
    expect(internMaterial(materials, undefined)).toBe(0);
    expect(internMaterial(materials, undefined)).toBe(0);
  });
});
