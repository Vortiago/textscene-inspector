// Runs oracle.gd for each instance of a case and writes the shaped advance and glyph of each character:
// variableAdvance.godot.json for the default case, variableAdvanceNoHvar.godot.json for NO_HVAR=1 and
// instanceGlyph.godot.json for the `recursive` case. Run it from this folder with Godot 4.6.3 on the path.
// Usage: [NO_HVAR=1] node gen.mjs <fixtures dir> <out path> [recursive]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [fixtures, out, caseName] = process.argv.slice(2);
const WGHT = 2003265652;
const WDTH = 2003072104;
const MONO = 1297043023;
const SLNT = 1936486004;
const CASES = {
  default: {
    font: process.env.NO_HVAR ? 'open-sans-variable-subset-no-hvar.ttf' : 'open-sans-variable-subset.ttf',
    characters: 'HamgiWD.',
    sizes: '9,12,16,20',
    instances: [
      { [WGHT]: 300 },
      { [WGHT]: 600 },
      { [WGHT]: 800 },
      { [WDTH]: 75 },
      { [WGHT]: 700, [WDTH]: 85 },
      { weight: 650.5 },
      { [WGHT]: 1000, [WDTH]: 50 },
      { [WGHT]: 100 },
    ],
  },
  // Recursive swaps glyphs by GSUB FeatureVariations: MONO gives the mono forms, slnt the slanted ones.
  recursive: {
    font: 'recursive-vf-subset.woff2',
    characters: 'agilfz0',
    sizes: '16',
    instances: [
      {},
      { [MONO]: 1 },
      { [MONO]: 0.5 },
      { [SLNT]: -15 },
      { [SLNT]: -5 },
      { [MONO]: 1, [SLNT]: -15 },
    ],
  },
};
const { font, characters, sizes, instances } = CASES[caseName ?? 'default'];
const glyphs = instances.flatMap((spec) => {
  const args = [join(fixtures, font), characters, sizes, JSON.stringify(spec)];
  const output = execFileSync(
    'godot',
    ['--headless', '--path', '.', '--script', 'oracle.gd', '--', ...args],
    { encoding: 'utf8' }
  );
  return JSON.parse(
    output
      .split('\n')
      .find((line) => line.startsWith('JSON:'))
      .slice(5)
  );
});
writeFileSync(out, JSON.stringify(glyphs, null, 2));
console.log(glyphs.length, 'glyphs');
