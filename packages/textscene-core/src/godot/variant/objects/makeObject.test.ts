import { describe, expect, it } from 'vitest';
import { UnsupportedObject, makeObject, readUidCache } from './makeObject';

describe('makeObject', () => {
  it('stops with the origin in the message and the owner of the object port', () => {
    expect(() => makeObject('weakref(...)')).toThrow(
      expect.objectContaining({ message: 'weakref(...) makes a Godot object', owner: '#1953' }) as Error
    );
  });
});

describe('readUidCache', () => {
  it('stops with the origin in the message and the owner of the uid lookup', () => {
    expect(() => readUidCache('str_to_var of Resource("uid://a")')).toThrow(
      expect.objectContaining({
        message: `str_to_var of Resource("uid://a") reads the project's uid cache`,
        owner: '#1815',
      }) as Error
    );
  });

  it('throws the same class as an object, so one catch handles both stops', () => {
    expect(() => readUidCache('x')).toThrow(UnsupportedObject);
  });
});
