import { describe, expect, it } from 'vitest';
import { propertyRefusal } from './propertyCheck.js';
import type { ParsedProperty } from '../../parser/TscnParserCore.js';
import '../index.js';

function property(ownerType: string | undefined, key: string, value: string): ParsedProperty {
  return {
    section: 'node',
    ownerType,
    key,
    value,
    line: 4,
    column: 0,
    valueStart: { line: 4, column: key.length + 3 },
    endLine: 4,
    isMultiline: value.includes('\n'),
    stored: { key, value },
  };
}

describe('propertyRefusal', () => {
  it('passes a value the validator accepts', () => {
    expect(propertyRefusal(property('Node3D', 'visible', 'true'))).toBeNull();
  });

  it('refuses a value the validator rejects', () => {
    expect(propertyRefusal(property('Node3D', 'visible', '"yes"'))).toMatchObject({ line: 4 });
  });

  it('reports null in a non-object slot as a conversion warning', () => {
    expect(propertyRefusal(property('Control', 'texture_filter', 'null'))).toMatchObject({
      severity: 'warning',
      message: expect.stringContaining('cannot hold'),
    });
  });

  it('skips a multi-line value', () => {
    expect(propertyRefusal(property('Node3D', 'visible', '"yes\nno"'))).toBeNull();
  });

  it('refuses a one-line value on the line after its key, at the value', () => {
    const later = { ...property('Node3D', 'visible', '"yes"'), endLine: 5, isMultiline: true };
    expect(propertyRefusal({ ...later, valueStart: { line: 5, column: 2 } })).toMatchObject({
      line: 5,
      column: 3,
    });
  });

  it('places the refusal where the value starts, past a key with no spaces around `=`', () => {
    const tight = { ...property('Node3D', 'visible', '"yes"'), valueStart: { line: 4, column: 8 } };
    expect(propertyRefusal(tight)).toMatchObject({ column: 9 });
  });

  it('skips a property with no typed owner', () => {
    expect(propertyRefusal(property(undefined, 'visible', '"yes"'))).toBeNull();
  });
});
