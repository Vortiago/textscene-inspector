/**
 * Writes `defaultTheme.godot.json`: every colour, constant, font size and StyleBox of Godot's default
 * theme (`ThemeDB.get_default_theme()`) and each variation's base, at each theme scale of `SCALES`.
 *
 *   node measure.mjs [--godot /usr/local/bin/godot]
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { godotBinary, rounded } from '../../../testing/measureKit.mjs';
import prettier from 'prettier';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(HERE, '../../defaultTheme.godot.json');
const SCALES = ['1', '1.5', '2'];
/** A colour channel is a 32-bit float: seven digits read back as the same float. */
const SIGNIFICANT_DIGITS = 7;

/** The default theme Godot builds in a project at `scale`. */
function captureAt(scale) {
  const project = mkdtempSync(join(tmpdir(), 'default-theme-'));
  try {
    writeFileSync(
      join(project, 'project.godot'),
      `config_version=5\n\n[gui]\n\ntheme/default_theme_scale=${scale}\n`
    );
    copyFileSync(join(HERE, 'dump.gd'), join(project, 'dump.gd'));
    const stdout = execFileSync(godotBinary(), ['--headless', '--path', project, '--script', 'dump.gd'], {
      encoding: 'utf8',
    });
    return rounded(
      JSON.parse(stdout.slice(stdout.indexOf('THEME\n') + 'THEME\n'.length)),
      SIGNIFICANT_DIGITS
    );
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

/** Formatted as the repository's Prettier config formats it, so a regenerated file passes the check. */
async function formatted(themes) {
  const options = await prettier.resolveConfig(OUTPUT);
  return prettier.format(JSON.stringify(themes), { ...options, filepath: OUTPUT });
}

writeFileSync(OUTPUT, await formatted(Object.fromEntries(SCALES.map((scale) => [scale, captureAt(scale)]))));
