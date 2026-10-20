import { describe, expect, it } from 'vitest';
import { acceptedResourceTypes, enumEntriesOf, flagLabels, rangeHint, rangeSuffix } from './hints';

/** `Variant::INT` (`variant.h:96-145`) and `PROPERTY_HINT_ENUM` (`object.h:50-96`). */
const INT = 2;
const ENUM = 2;

/** The labels an integer property with an enum hint over `hintString` offers. */
const enumEntries = (hintString: string) => enumEntriesOf({ type: INT, hint: ENUM, hintString });

describe('hints', () => {
  it('numbers an enum label by its index when the label carries no value', () => {
    expect(enumEntries('Euler,Quaternion,Basis')).toEqual([
      { label: 'Euler', value: '0' },
      { label: 'Quaternion', value: '1' },
      { label: 'Basis', value: '2' },
    ]);
  });

  it('honours a label that carries its own value, and keeps the next index after it', () => {
    expect(enumEntries('Off,On:4,Auto')).toEqual([
      { label: 'Off', value: '0' },
      { label: 'On', value: '4' },
      { label: 'Auto', value: '2' },
    ]);
  });

  it('treats an empty hint string as no labels rather than one empty label', () => {
    expect(enumEntries('')).toEqual([]);
  });

  it('separates an enum and a suggestion hint from every other hint', () => {
    const offered = (hint: number) => enumEntriesOf({ type: INT, hint, hintString: 'A,B' }).length > 0;
    expect(offered(2)).toBe(true);
    expect(offered(3)).toBe(true);
    expect(offered(6)).toBe(false);
  });

  it('offers no labels for an enum hint on a property that is not an integer (edge case)', () => {
    // `Variant::STRING` is 4.
    expect(enumEntriesOf({ type: 4, hint: ENUM, hintString: 'A,B' })).toEqual([]);
  });

  it('names the resource classes a slot accepts, dropping an excluded subclass', () => {
    expect(acceptedResourceTypes(17, 'NoiseTexture,GradientTexture2D')).toEqual([
      'NoiseTexture',
      'GradientTexture2D',
    ]);
    expect(acceptedResourceTypes(17, 'Texture2D,-MeshTexture')).toEqual(['Texture2D']);
    expect(acceptedResourceTypes(0, 'Mesh')).toBeUndefined();
  });

  it('opens a range end that or_greater or or_less leaves open', () => {
    expect(rangeHint(1, '0,10,1,or_greater')).toEqual({ min: '0', max: '10', hasMin: true, hasMax: false });
    expect(rangeHint(1, '-1,1,0.01')).toEqual({ min: '-1', max: '1', hasMin: true, hasMax: true });
    expect(rangeHint(0, '0,10')).toBeUndefined();
  });

  it('reads the unit a range appends to its bounds', () => {
    expect(rangeSuffix(1, '-24,6,suffix:dB')).toBe('dB');
    expect(rangeSuffix(1, '0,10,1')).toBeUndefined();
  });

  it('lists the bits of a flags hint and nothing for another hint', () => {
    expect(flagLabels(6, 'A,B,C')).toEqual(['A', 'B', 'C']);
    expect(flagLabels(2, 'A,B')).toBeUndefined();
  });
});
