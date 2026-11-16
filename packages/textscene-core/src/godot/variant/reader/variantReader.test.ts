import { describe, expect, it } from 'vitest';
import { variantToText } from '../variantWriter';
import { textToVariant } from './variantReader';

const read = (text: string) => variantToText(textToVariant(text));

// Each value is what Godot 4.6.3's str_to_var returns for the text, written by var_to_str.
describe('textToVariant', () => {
  it('reads a constructor with float32 components', () => {
    expect(read('Vector2(0.1, inf_neg)')).toBe('Vector2(0.1, inf_neg)');
  });

  it('types an array by a class outside the node and resource hierarchies', () => {
    expect(read('Array[WeakRef]([])')).toBe('Array[WeakRef]([])');
  });

  it('leaves an array untyped for a class ClassDB does not know', () => {
    expect(read('Array[Nope]([1])')).toBe('[1]');
  });

  it('gives null for a syntax error inside a container', () => {
    expect(read('[NodePath("a"')).toBe('null');
  });

  it('keeps an outer NodePath it stored before the missing parenthesis (edge case)', () => {
    expect(read('NodePath("a"')).toBe('NodePath("a")');
  });

  it('takes a trailing comma in an array but not in a constructor (edge case)', () => {
    expect([read('[1, 2,]'), read('Vector2(1, 2,)')]).toEqual(['[1, 2]', 'null']);
  });
});
