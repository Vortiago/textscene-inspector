import { describe, expect, it } from 'vitest';
import { enumNamesByValue, enumValues, labelEnumNames, pascalCaseLabel, relabelEnumNames } from './enumNames';

enum Shade {
  DARK = 0,
  LIGHT = 2,
}

describe('enumNamesByValue', () => {
  it('names each member by its integer', () => {
    expect(enumNamesByValue(Shade)).toEqual({ 0: 'DARK', 2: 'LIGHT' });
  });

  it('leaves out the reverse entries a numeric TS enum adds', () => {
    expect(Object.values(enumNamesByValue(Shade))).not.toContain('0');
  });

  it('gives an empty map for an enum with no numeric member', () => {
    expect(enumNamesByValue({})).toEqual({});
  });
});

describe('relabelEnumNames', () => {
  it('turns each name by the label function and keeps its integer', () => {
    expect(relabelEnumNames(enumNamesByValue(Shade), (name) => `${name}_SHADE`)).toEqual({
      0: 'DARK_SHADE',
      2: 'LIGHT_SHADE',
    });
  });

  it('gives an empty map for an empty table', () => {
    expect(relabelEnumNames({}, (name) => name)).toEqual({});
  });
});

describe('enumValues', () => {
  enum Sample {
    A = 0,
    B = 3,
  }

  it('lists the integers in declaration order, without the reverse-mapped names', () => {
    expect(enumValues(Sample)).toEqual([0, 3]);
  });
});

describe('pascalCaseLabel', () => {
  it('joins the words of a member name in PascalCase', () => {
    expect(pascalCaseLabel('SPECIFIC_BONE')).toBe('SpecificBone');
  });

  it('capitalises a one-word member name', () => {
    expect(pascalCaseLabel('LINEAR')).toBe('Linear');
  });
});

describe('labelEnumNames', () => {
  it('labels each member by its integer', () => {
    const Pair = { OPEN_XR: 0, HUMANOID: 1 } as const;
    expect(labelEnumNames(Pair, { OPEN_XR: 'OpenXR', HUMANOID: 'Humanoid' })).toEqual({
      0: 'OpenXR',
      1: 'Humanoid',
    });
  });
});
