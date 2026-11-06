// Runs oracle.gd for each case and writes the glyphs Godot 4.6.3's shaper gives each text: glyph index, cluster,
// advance and offset. Run it from this folder with Godot 4.6.3 on the path.
// Usage: node gen.mjs <repository root> <out path>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [root, out] = process.argv.slice(2);
const FIXTURES = join(root, 'scenes/fixtures/fonts');
const WGHT = 2003265652;
// Typed base and marks: Godot composes a pair the font has a character for, and else places the marks.
const TYPED_MARKS = [
  'A\u0308',
  'a\u0308',
  'A\u0323\u0308',
  'A\u0308\u0323',
  'e\u0301x',
  'o\u0302\u0301',
  'a\u0308\u0308',
  'x\u0301',
  'na\u0308n',
];
const CASES = [
  {
    font: join(FIXTURES, 'montserrat-semibold-marks-subset.ttf'),
    texts: TYPED_MARKS,
    sizes: '16,32',
    opentype: {},
  },
  {
    font: join(FIXTURES, 'montserrat-semibold-marks-nogpos-subset.ttf'),
    texts: TYPED_MARKS,
    sizes: '16,32',
    opentype: {},
  },
  {
    font: join(FIXTURES, 'montserrat-semibold-subset.ttf'),
    texts: ['fi', 'office', 'fly', 'ffi'],
    sizes: '16,32',
    opentype: {},
  },
  // Godot's default theme font: `ff`, `fi`, `fl`, `ffi` and `ffl` are ligatures.
  {
    font: join(root, 'packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2'),
    texts: [
      'fi',
      'fl',
      'ff',
      'ffi',
      'ffl',
      'office',
      'afflict',
      'Tffi.',
      'fifi',
      'ft',
      'fj',
      'Th',
      'A\u0308',
      'a\u0308\u0301',
    ],
    sizes: '12,16,24,32',
    opentype: {},
  },
  // A contextual `rvrn` rule from wght 650: `a` before `b`, and `l` after `i` (scripts/fonts/contextual-rvrn).
  ...[{}, { [WGHT]: 600 }, { [WGHT]: 700 }, { [WGHT]: 1000 }].map((opentype) => ({
    font: join(FIXTURES, 'recursive-contextual-rvrn.woff2'),
    texts: ['ab', 'ba', 'abab', 'il', 'li', 'ilb', 'aab', 'a b'],
    sizes: '16,32',
    opentype,
  })),
];

const rows = CASES.flatMap(({ font, texts, sizes, opentype }) => {
  const output = execFileSync(
    'godot',
    [
      '--headless',
      '--path',
      '.',
      '--script',
      'oracle.gd',
      '--',
      font,
      JSON.stringify(texts),
      sizes,
      JSON.stringify(opentype),
    ],
    { encoding: 'utf8' }
  );
  const json = output.split('\n').find((line) => line.startsWith('JSON:'));
  return JSON.parse(json.slice('JSON:'.length)).map((row) => ({ font: font.split('/').pop(), ...row }));
});
writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);
