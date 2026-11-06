// Runs oracle.gd for each mark font of the decomposed-marks fixtures and writes what Godot 4.6.3 gives
// each character: its glyphs, their advances and their offsets. Run it from this folder with Godot on the path.
// Usage: node gen.mjs <fixtures fonts dir> <out path>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [fonts, out] = process.argv.slice(2);
const FONTS = [
  'montserrat-semibold-marks-subset.ttf',
  'montserrat-semibold-marks-nogpos-subset.ttf',
  'montserrat-semibold-marks-nomark-subset.ttf',
];
const CHARACTERS = 'ÀÁÂÃÄÅäöüéÉǞẠ';
const SIZES = '16,32';

const rows = FONTS.flatMap((font) => {
  const output = execFileSync(
    'godot',
    ['--headless', '--path', '.', '--script', 'oracle.gd', '--', join(fonts, font), CHARACTERS, SIZES],
    { encoding: 'utf8' }
  );
  return JSON.parse(output.split('\n').find((line) => line.startsWith('[')));
});
writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);
