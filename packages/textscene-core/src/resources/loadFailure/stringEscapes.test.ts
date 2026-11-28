import { describe, expect, it } from 'vitest';
import { strToVar } from '../../godot/variant/strToVar';
import { VARIANT_TYPE } from '../../godot/variant/variantType';
import { TscnParser } from '../../parser/TscnParser';
import { unquoteString } from '../../parser/utils';
import { valueOfSceneValue, variant } from '../../scene/variant';
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

/** `str_to_var` of `"A` and each escape as code points, or `refused` for Nil (`strToVarOracle.mjs`). */
const GODOT_STR_TO_VAR: Record<string, string> = {
  b: '41 8',
  t: '41 9',
  n: '41 A',
  f: '41 C',
  r: '41 D',
  quote: '41 22',
  backslash: '41 5C',
  other: '41 71',
  other_utf8: '41 E9',
  u_ascii: '41 41',
  u_latin: '41 E9',
  u_bmp: '41 20AC',
  u_nul: '41 FFFD',
  u_utf8_pair: '41 C3 A9',
  u_cut_sequence: '41 E2 82',
  raw_astral_then_escape: '41 1F600 9',
  u_ffff: '41 FFFF',
  u_short: 'refused',
  u_nonhex: 'refused',
  U_ascii: '41 41',
  U_astral: '41 1F600',
  U_max: '41 10FFFF',
  U_past: '41 FFFD',
  U_top: '41 FFFD',
  U_surrogate: 'refused',
  pair: '41 1F600',
  lone_lead: 'refused',
  lead_then_char: 'refused',
  lone_trail: 'refused',
  lead_lead: 'refused',
};

const codePoints = (text: string) =>
  [...text].map((c) => c.codePointAt(0)!.toString(16).toUpperCase()).join(' ');

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
const literal = (name: string) => `"A${ESCAPES[name]}"`;
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

describe('each string escape, as each reader of a string decodes it', () => {
  it('measures every escape through str_to_var', () => {
    expect(Object.keys(GODOT_STR_TO_VAR).sort()).toEqual([...NAMES].sort());
  });

  it.each(LOADING)('reads a body value with %s as the file load builds the heading name', (name) => {
    expect(strToVar(literal(name))).toEqual({ type: VARIANT_TYPE.STRING, value: GODOT_NAME[name] });
  });

  it.each(REFUSED)('reads a body value with %s as Nil, as the file load refuses it', (name) => {
    expect(strToVar(literal(name)).type).toBe(VARIANT_TYPE.NIL);
  });

  it.each(LOADING)('unquotes a string with %s as the file load builds the heading name', (name) => {
    expect(unquoteString(literal(name))).toBe(GODOT_NAME[name]);
  });

  const stringReads = NAMES.filter((name) => GODOT_STR_TO_VAR[name] !== 'refused');
  it.each(stringReads)('reads variant text with %s as str_to_var does', (name) => {
    const read = valueOfSceneValue(variant(literal(name)));
    expect(read.type === VARIANT_TYPE.STRING && codePoints(read.value)).toBe(GODOT_STR_TO_VAR[name]);
  });

  it.each(NAMES.filter((name) => GODOT_STR_TO_VAR[name] === 'refused'))(
    'refuses variant text with %s as str_to_var does',
    (name) => {
      expect(() => variant(literal(name))).toThrow(/expected a Variant/);
    }
  );
});
