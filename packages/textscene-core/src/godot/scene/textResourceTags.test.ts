import { describe, expect, it } from 'vitest';
import { hasBody, missingField } from './textResourceTags';

describe('missingField', () => {
  it.each([
    ['ext_resource', ['id'], 'path'],
    ['ext_resource', ['path', 'id'], 'type'],
    ['sub_resource', ['type'], 'id'],
    ['connection', ['from', 'to', 'signal'], 'method'],
  ])('names the first required field a [%s] with %j lacks', (type, keys, field) => {
    expect(missingField(type, keys)).toBe(field);
  });

  it('names none for a tag with every required field', () => {
    expect(missingField('ext_resource', ['path', 'type', 'id'])).toBeUndefined();
  });

  it('names none for a tag that requires no field', () => {
    expect(missingField('node', [])).toBeUndefined();
  });

  it('names none for a name on the object prototype', () => {
    expect(missingField('constructor', [])).toBeUndefined();
  });
});

describe('hasBody', () => {
  it.each(['node', 'sub_resource', 'resource'])('reads a body after [%s]', (type) => {
    expect(hasBody(type)).toBe(true);
  });

  it.each(['gd_scene', 'ext_resource', 'connection', 'editable'])('reads no body after [%s]', (type) => {
    expect(hasBody(type)).toBe(false);
  });
});
