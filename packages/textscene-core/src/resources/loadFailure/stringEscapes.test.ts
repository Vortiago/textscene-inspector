import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import { previewerLoadResult } from './headingSweep.testkit';

/** Each escape form, as the oracle's `stringEscapeSweep.mjs` writes it inside a string. */
const ESCAPES: Record<string, string> = {
  b: '\\b',
  t: '\\t',
  n: '\\n',
  f: '\\f',
  r: '\\r',
  quote: '\\"',
  backslash: '\\\\',
  other: '\\q',
  other_utf8: '\\é',
  u_ascii: '\\u0041',
  u_latin: '\\u00e9',
  u_bmp: '\\u20ac',
  u_nul: '\\u0000',
  u_utf8_pair: '\\u00C3\\u00A9',
  u_cut_sequence: '\\u00E2\\u0082',
  raw_astral_then_escape: '\u{1F600}\\t',
  u_ffff: '\\uFFFF',
  u_short: '\\u12',
  u_nonhex: '\\u00G1',
  U_ascii: '\\U000041',
  U_astral: '\\U01F600',
  U_max: '\\U10FFFF',
  U_past: '\\U110000',
  U_top: '\\UFFFFFF',
  U_surrogate: '\\U00D83D',
  pair: '\\uD83D\\uDE00',
  lone_lead: '\\uD83D',
  lead_then_char: '\\uD83Dx',
  lone_trail: '\\uDE00',
  lead_lead: '\\uD83D\\uD83D',
};

/** Node A's name as Godot 4.6.3 builds it with each escape, or `refused` where the load stops (measured). */
const GODOT_NAME: Record<string, string> = {
  b: 'A\b',
  t: 'A\t',
  n: 'A\n',
  f: 'A\f',
  r: 'A\r',
  quote: 'A"',
  backslash: 'A\\',
  other: 'Aq',
  other_utf8: 'Aé',
  u_ascii: 'AA',
  u_latin: 'A�',
  u_bmp: 'A ',
  u_nul: 'A ',
  u_utf8_pair: 'Aé',
  u_cut_sequence: 'A\uFFFD\uFFFD',
  raw_astral_then_escape: 'A\u{1F600}\t',
  u_ffff: 'A ',
  u_short: 'refused',
  u_nonhex: 'refused',
  U_ascii: 'AA',
  U_astral: 'A ',
  U_max: 'A ',
  U_past: 'A ',
  U_top: 'A ',
  U_surrogate: 'refused',
  pair: 'A ',
  lone_lead: 'refused',
  lead_then_char: 'refused',
  lone_trail: 'refused',
  lead_lead: 'refused',
};

const HEAD = ['[gd_scene format=3]', '', '[node name="Root" type="Node2D"]', ''];

function headingFile(name: string): { path: string; text: string } {
  const lines = [`[node name="A${ESCAPES[name]}" type="Node2D" parent="."]`, 'position = Vector2(5, 5)'];
  return { path: `res://${name}__heading.tscn`, text: [...HEAD, ...lines, ''].join('\n') };
}

function bodyFile(name: string): { path: string; text: string } {
  const lines = [
    '[node name="A" type="Node2D" parent="."]',
    `metadata/x = "${ESCAPES[name]}"`,
    'position = Vector2(5, 5)',
  ];
  return { path: `res://${name}__body.tscn`, text: [...HEAD, ...lines, ''].join('\n') };
}

const NAMES = Object.keys(ESCAPES);
const LOADING = NAMES.filter((name) => GODOT_NAME[name] !== 'refused');
const REFUSED = NAMES.filter((name) => GODOT_NAME[name] === 'refused');

describe('each string escape, as Godot 4.6.3 reads it from a file', () => {
  it('measures every escape', () => {
    expect(Object.keys(GODOT_NAME).sort()).toEqual([...NAMES].sort());
  });

  it.each(LOADING)('builds the heading name with %s as Godot does', (name) => {
    const scene = new TscnParser().parse(headingFile(name).text);
    expect(scene.nodes[0]?.children[0]?.name).toBe(GODOT_NAME[name]);
  });

  it.each(REFUSED)('stops the load at a heading name with %s', (name) => {
    const file = headingFile(name);
    expect(previewerLoadResult(file)).toBe(`Parse Error: Parse error. [Resource file ${file.path}:5]`);
  });

  it.each(LOADING)('loads a body string with %s', (name) => {
    expect(previewerLoadResult(bodyFile(name))).toBe('loads Root[A(5.0, 5.0)]');
  });

  // The body reader judges no body value yet, so the previewer loads where Godot stops at line 6.
  it.each(REFUSED)('loads a body string with %s, where Godot stops', (name) => {
    expect(previewerLoadResult(bodyFile(name))).toBe('loads Root[A(5.0, 5.0)]');
  });
});
