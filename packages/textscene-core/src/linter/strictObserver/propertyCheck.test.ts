import { describe, expect, it } from 'vitest';
import { propertyError } from './propertyCheck.js';
import type { ParsedProperty } from '../../parser/TscnParserCore.js';
import '../index.js';

function property(
  ownerType: string | undefined,
  key: string,
  value: string,
  isMultiline = false
): ParsedProperty {
  return { section: 'node', ownerType, key, value, line: 4, isMultiline, stored: { key, value } };
}

describe('propertyError', () => {
  it('passes a value the validator accepts', () => {
    expect(propertyError(property('Node3D', 'visible', 'true'))).toBeNull();
  });

  it('refuses a value the validator rejects', () => {
    expect(propertyError(property('Node3D', 'visible', '"yes"'))).toMatchObject({ line: 4 });
  });

  it('reports null in a non-object slot as a conversion warning', () => {
    expect(propertyError(property('Control', 'texture_filter', 'null'))).toMatchObject({
      severity: 'warning',
      message: expect.stringContaining('cannot hold'),
    });
  });

  it('skips a multi-line value and a property with no typed owner', () => {
    expect(propertyError(property('Node3D', 'visible', '"yes"', true))).toBeNull();
    expect(propertyError(property(undefined, 'visible', '"yes"'))).toBeNull();
  });
});
