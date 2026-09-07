/**
 * Every expectation here is the name Godot 4.7.2 ends up with, read off a
 * headless instantiate rather than derived from `ustring.cpp` alone.
 */

import { describe, expect, it } from 'vitest';
import { validateNodeName } from './nodeName.js';

describe('validateNodeName', () => {
  it('leaves a name carrying none of the invalid characters alone', () => {
    expect(validateNodeName('Player2')).toBe('Player2');
  });

  it.each([['.'], [':'], ['@'], ['/'], ['"'], ['%']])(
    'replaces %s, which `invalid_node_name_characters` lists',
    (character) => {
      expect(validateNodeName(`A${character}B`)).toBe('A_B');
    }
  );

  it('keeps `#`, which the re-parent rename joins on', () => {
    // `packed_scene.cpp:562` builds `<path>#<name>` and hands the whole string
    // to `set_name`, so `#` surviving is what makes the rename readable.
    expect(validateNodeName('Gone@Deeper#Leaf')).toBe('Gone_Deeper#Leaf');
  });

  it('replaces every occurrence, not just the first', () => {
    expect(validateNodeName('Other@..@Mid#Body')).toBe('Other____Mid#Body');
  });

  it('returns the empty string unchanged', () => {
    expect(validateNodeName('')).toBe('');
  });

  it('counts an astral character as one, the way a char32_t scan does', () => {
    expect(validateNodeName('A\u{1F600}.B')).toBe('A\u{1F600}_B');
  });
});
