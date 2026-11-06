// Runs oracle.gd for each instance of a case and writes what Godot's shaper gives each character: its
// advance and glyph, and the kerning of each pair a case lists. Godot 4.6.3 must be on the path.
// Cases and their files: open-sans (variableAdvance.godot.json), open-sans-no-hvar (variableAdvanceNoHvar.godot.json),
// recursive (instanceGlyph.godot.json) and gpos-feature-variations (instanceGposVariations.godot.json).
// Usage: node gen.mjs <fixtures dir> <out path> <case>
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGodotOracle } from '../godot-oracle/godotOracle.mjs';

const ORACLE = fileURLToPath(new URL('oracle.gd', import.meta.url));

const [fixtures, out, caseName] = process.argv.slice(2);
const WGHT = 2003265652;
const WDTH = 2003072104;
const MONO = 1297043023;
const SLNT = 1936486004;
const CASL = 1128354636;
const OPEN_SANS = {
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
};
const CASES = {
  'open-sans': { ...OPEN_SANS, font: 'open-sans-variable-subset.ttf' },
  'open-sans-no-hvar': { ...OPEN_SANS, font: 'open-sans-variable-subset-no-hvar.ttf' },
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
  // A GPOS FeatureVariations record kerns AV by a further -300 units where CASL is 0.5 or more.
  'gpos-feature-variations': {
    font: 'recursive-gpos-feature-variations.woff2',
    characters: 'A',
    sizes: '12,16,20',
    pairs: 'AV,AT,VA',
    instances: [{}, { [CASL]: 0.25 }, { [CASL]: 0.5 }, { [CASL]: 1 }, { [CASL]: 0.75, [MONO]: 1 }],
  },
};
if (!(caseName in CASES)) {
  throw new Error(`expected a case of ${Object.keys(CASES).join(', ')}, got ${caseName}`);
}
const { font, characters, sizes, pairs, instances } = CASES[caseName];
const glyphs = instances.flatMap((spec) => {
  const args = [resolve(fixtures, font), characters, sizes, JSON.stringify(spec), ...(pairs ? [pairs] : [])];
  return runGodotOracle(ORACLE, args);
});
writeFileSync(out, JSON.stringify(glyphs, null, 2));
console.log(glyphs.length, 'rows');
