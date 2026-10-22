import { describe, expect, it } from 'vitest';
import { enumNamesByValue, flagLabels, labelEnumNames, pascalCaseLabel, relabelEnumNames } from './enumNames';

const Shade = { DARK: 0, LIGHT: 2 } as const;

describe('enumNamesByValue', () => {
  it('names each member by its integer', () => {
    expect(enumNamesByValue(Shade)).toEqual({ 0: 'DARK', 2: 'LIGHT' });
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

describe('flagLabels', () => {
  const Flags = { NONE: 0, FIRST: 1, SECOND: 2, FOURTH: 8 } as const;

  it('labels each listed flag by its bit, with the prefix before the member name', () => {
    expect(flagLabels(Flags, 'FLAG_', ['FIRST', 'FOURTH'])).toEqual({ 1: 'FLAG_FIRST', 8: 'FLAG_FOURTH' });
  });

  it('leaves out a flag that is not listed', () => {
    expect(Object.keys(flagLabels(Flags, 'FLAG_', ['FIRST']))).toEqual(['1']);
  });
});
