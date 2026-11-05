// Runs oracle.gd for each instance and writes variableAdvance.godot.json, or variableAdvanceNoHvar.godot.json
// for NO_HVAR=1. Run it from this folder with Godot 4.6.3 on the path.
// Usage: [NO_HVAR=1] node gen.mjs <fixtures dir> <out path>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [fixtures, out] = process.argv.slice(2);
const WGHT = 2003265652;
const WDTH = 2003072104;
const instances = [
  { [WGHT]: 300 },
  { [WGHT]: 600 },
  { [WGHT]: 800 },
  { [WDTH]: 75 },
  { [WGHT]: 700, [WDTH]: 85 },
  { weight: 650.5 },
  { [WGHT]: 1000, [WDTH]: 50 },
  { [WGHT]: 100 },
];
const glyphs = instances.flatMap((spec) => {
  const args = [
    join(
      fixtures,
      process.env.NO_HVAR ? 'open-sans-variable-subset-no-hvar.ttf' : 'open-sans-variable-subset.ttf'
    ),
    'HamgiWD.',
    '9,12,16,20',
    JSON.stringify(spec),
  ];
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
