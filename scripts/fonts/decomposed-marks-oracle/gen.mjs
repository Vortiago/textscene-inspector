// Runs oracle.gd for each mark font of the decomposed-marks fixtures and writes what Godot 4.6.3 gives
// each character: its glyphs, their advances and their offsets. Godot must be on the path.
// Usage: node gen.mjs <fixtures fonts dir> <out path>
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGodotOracle } from '../godot-oracle/godotOracle.mjs';

const ORACLE = fileURLToPath(new URL('oracle.gd', import.meta.url));

const [fonts, out] = process.argv.slice(2);
const FONTS = [
  'montserrat-semibold-marks-subset.ttf',
  'montserrat-semibold-marks-nogpos-subset.ttf',
  'montserrat-semibold-marks-nomark-subset.ttf',
  'montserrat-semibold-marks-nolookups-subset.ttf',
];
const CHARACTERS = 'ÀÁÂÃÄÅäöüéÉǞẠ';
const SIZES = '16,32';

const rows = FONTS.flatMap((font) => runGodotOracle(ORACLE, [resolve(fonts, font), CHARACTERS, SIZES]));
writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);
