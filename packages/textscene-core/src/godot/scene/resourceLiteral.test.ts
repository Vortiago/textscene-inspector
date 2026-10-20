import { describe, expect, it } from 'vitest';
import { holdsResource } from './resourceLiteral';

describe('holdsResource', () => {
  it('holds a resource for a reference literal', () => {
    expect(holdsResource('ExtResource("1_tex")')).toBe(true);
  });

  it('holds none when the property is absent', () => {
    expect(holdsResource(undefined)).toBe(false);
  });

  it('holds none for the null literal, with or without surrounding space', () => {
    expect(holdsResource('null')).toBe(false);
    expect(holdsResource('  null ')).toBe(false);
  });

  it('holds none for an empty or blank value', () => {
    expect(holdsResource('')).toBe(false);
    expect(holdsResource('   ')).toBe(false);
  });
});
