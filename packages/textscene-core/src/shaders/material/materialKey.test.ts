import { describe, expect, it } from 'vitest';
import { keyText } from './materialKey.js';
import { materialStateOf } from './materialProperties.js';

const keyTextOf = (settings: Record<string, boolean | number>) =>
  keyText(materialStateOf('StandardMaterial3D', settings).key);

describe('keyText', () => {
  it('is the same for two materials whose setters ran in another order', () => {
    expect(keyTextOf({ rim_enabled: true, emission_enabled: true })).toBe(
      keyTextOf({ emission_enabled: true, rim_enabled: true })
    );
  });

  it('differs for a material that changes one member the text reads', () => {
    expect(keyTextOf({ rim_enabled: true })).not.toBe(keyTextOf({}));
  });

  it('ignores a property the text does not read', () => {
    expect(keyTextOf({ roughness: 0.5 })).toBe(keyTextOf({}));
  });
});
