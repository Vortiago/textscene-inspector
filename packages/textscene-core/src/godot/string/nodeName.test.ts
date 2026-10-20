/**
 * Each expectation is the name Godot ends up with, read off a headless instantiate rather than
 * derived from `ustring.cpp` alone. The empty name
 * cannot be: `ERR_FAIL_COND(p_name.is_empty())` (`node.cpp:1432`) returns before
 * `validate_node_name()`, so that row cites the port.
 */

import { describe, expect, it } from 'vitest';
import { serialChildName, validateNodeName } from './nodeName.js';

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
    // `validate_node_name` returns `String()` for a null buffer
    // (`ustring.cpp:5094-5096`) and the scan below it never runs.
    expect(validateNodeName('')).toBe('');
  });

  it('counts an astral character as one, the way a char32_t scan does', () => {
    expect(validateNodeName('A\u{1F600}.B')).toBe('A\u{1F600}_B');
  });
});

describe('serialChildName', () => {
  it('keeps a name no sibling holds', () => {
    expect(serialChildName('Gone#A', new Set(['Other']))).toBe('Gone#A');
  });

  it('numbers an undecorated name from 2', () => {
    // `node.cpp:1631-1634`: the second node takes `2`, so the first needs no number.
    expect(serialChildName('Gone#A', new Set(['Gone#A']))).toBe('Gone#A2');
  });

  it('takes the next free number past a run of taken ones', () => {
    expect(serialChildName('Gone#A', new Set(['Gone#A', 'Gone#A2', 'Gone#A3']))).toBe('Gone#A4');
  });

  it('counts on from a trailing number, as `increase_numeric_string` does', () => {
    expect(serialChildName('Wall1', new Set(['Wall1']))).toBe('Wall2');
  });

  it('carries a run of nines through every digit (edge case)', () => {
    expect(serialChildName('Wall9', new Set(['Wall9']))).toBe('Wall10');
    expect(serialChildName('Wall99', new Set(['Wall99']))).toBe('Wall100');
  });
});
