/** The phase-2 readers of a vector slot: the stored components, or `null` to stay silent. */
import { describe, it, expect } from 'vitest';
import { matchVector2, matchVector3 } from './vectorValidators.js';

describe('matchVector3', () => {
  it('reads the three components', () => {
    expect(matchVector3('Vector3(1, -2.5, 3e1)')).toEqual({ x: 1, y: -2.5, z: 30 });
  });

  it('reads the non-finite literals Godot writes', () => {
    const vector = matchVector3('Vector3(inf, -inf, nan)');
    expect(vector?.x).toBe(Infinity);
    expect(vector?.y).toBe(-Infinity);
    expect(vector?.z).toBeNaN();
  });

  it('reads the Vector3i spelling Godot converts into the slot', () => {
    expect(matchVector3('Vector3i(1, 2, 3)')).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('refuses a literal that is not three components', () => {
    expect(matchVector3('Vector3(1, 2)')).toBeNull();
    expect(matchVector3('Vector2(1, 2)')).toBeNull();
    expect(matchVector3('garbage')).toBeNull();
  });

  it('refuses a Vector3i component no int32 holds, rather than name a value the file does not state', () => {
    expect(matchVector3('Vector3i(4294967296, 0, 0)')).toBeNull();
  });
});

describe('matchVector2', () => {
  it('reads the two components', () => {
    expect(matchVector2('Vector2(1, -2.5)')).toEqual({ x: 1, y: -2.5 });
  });

  it('reads a literal with surrounding white space', () => {
    expect(matchVector2('  Vector2(3, 4)  ')).toEqual({ x: 3, y: 4 });
  });

  it('reads the non-finite literals Godot writes', () => {
    const vector = matchVector2('Vector2(inf, nan)');
    expect(vector?.x).toBe(Infinity);
    expect(vector?.y).toBeNaN();
  });

  it('reads the Vector2i spelling as the int32 components Godot stores', () => {
    expect(matchVector2('Vector2i(0.5, -1.5)')).toEqual({ x: 0, y: -1 });
  });

  it('refuses a literal that is not two components', () => {
    expect(matchVector2('Vector2(1)')).toBeNull();
    expect(matchVector2('Vector3(1, 2, 3)')).toBeNull();
    expect(matchVector2('garbage')).toBeNull();
  });

  it('refuses a Vector2i component no int32 holds, rather than name a value the file does not state', () => {
    expect(matchVector2('Vector2i(4294967296, 0)')).toBeNull();
  });
});
