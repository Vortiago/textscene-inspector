/** Which sky materials Godot debands, read from the decoded material. */
import { describe, expect, it } from 'vitest';
import { isDebanded } from './debanding';
import { decodeSkyMaterial } from './decode';
import type { SkyProperties } from './types';

function material(type: string, data: Record<string, string> = {}): SkyProperties {
  return decodeSkyMaterial(type, data)!;
}

describe('isDebanded', () => {
  it('debands a ProceduralSkyMaterial by default, as its constructor sets', () => {
    expect(isDebanded(material('ProceduralSkyMaterial'))).toBe(true);
  });

  it('debands a PhysicalSkyMaterial by default, as its constructor sets', () => {
    expect(isDebanded(material('PhysicalSkyMaterial'))).toBe(true);
  });

  it('does not deband a sky that turns use_debanding off', () => {
    expect(isDebanded(material('ProceduralSkyMaterial', { use_debanding: 'false' }))).toBe(false);
  });

  it('never debands a PanoramaSkyMaterial, which has no such mode (edge case)', () => {
    expect(isDebanded(material('PanoramaSkyMaterial'))).toBe(false);
  });
});
