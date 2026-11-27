import { writeCaseFiles } from './writeCaseFiles.mjs';

/** Each escape form Godot's string tokenizer reads, at and past its limits (variant_parser.cpp:288-395). */
const ESCAPES = {
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

/** The escape in node A's heading name, which the tree prints, or in a body string, which it does not. */
const PLACES = {
  heading: (escape) => [`[node name="A${escape}" type="Node2D" parent="."]`, 'position = Vector2(5, 5)'],
  body: (escape) => [
    '[node name="A" type="Node2D" parent="."]',
    `metadata/x = "${escape}"`,
    'position = Vector2(5, 5)',
  ],
};

const cases = Object.entries(ESCAPES).flatMap(([name, escape]) =>
  Object.entries(PLACES).map(([place, lines]) => ({
    file: `${name}__${place}.tscn`,
    text: ['[gd_scene format=3]', '', '[node name="Root" type="Node2D"]', '', ...lines(escape), ''].join(
      '\n'
    ),
  }))
);
console.log(writeCaseFiles(process.argv[2], cases));
