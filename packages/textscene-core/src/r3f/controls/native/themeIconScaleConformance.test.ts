/**
 * Drift guard: a size constant for a default-theme icon is read only through `scaledIconSize` or
 * `scaledIconSizeOf`. Godot rasterises each icon at the theme scale (`default_theme.cpp:82-84`),
 * so a bare read lays the Control out at scale 1.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductionSource, offendingLines, reportOffenders, walkSources } from '../../testing/sourceScan';

const SRC_ROOT = join(import.meta.dirname, '../../..');
const ICON_SIZE_CONSTANT = /\b[A-Z][A-Z_]*ICON_(?:NATURAL_)?SIZE\b/;
const SCALED_READ = /\bscaledIconSize(?:Of)?\(\s*[A-Z][A-Z_]*ICON_(?:NATURAL_)?SIZE\b/;
/** A definition, or an import line that names only the constant. */
const DECLARATION =
  /^\s*(?:export\s+)?const\s+[A-Z][A-Z_]*ICON_(?:NATURAL_)?SIZE\b|^\s*import\b|^\s*[A-Z][A-Z_]*,?\s*$/;

/** The tests of these folders name their own constants, so only production code is scanned. */
const SOURCES = walkSources([join(SRC_ROOT, 'nodes'), join(SRC_ROOT, 'r3f')], isProductionSource);

function unscaledReadLines(source: string): number[] {
  const lines = source.split('\n');
  return offendingLines(source, ICON_SIZE_CONSTANT).filter((lineNumber) => {
    const line = lines[lineNumber - 1]!;
    return !DECLARATION.test(line) && !SCALED_READ.test(line);
  });
}

describe('default-theme icon size conformance', () => {
  it('reads every icon size constant through scaledIconSize or scaledIconSizeOf', () => {
    const offenders = reportOffenders(SOURCES, unscaledReadLines);
    expect(
      offenders,
      `these lines read an authored icon size without the theme scale: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('would catch a bare read of an icon size constant — the check is not vacuous', () => {
    expect(unscaledReadLines('  const side = TAB_BAR_ICON_SIZE;')).toEqual([1]);
    expect(unscaledReadLines('  const side = scaledIconSize(TAB_BAR_ICON_SIZE, scale);')).toEqual([]);
    expect(unscaledReadLines('export const TAB_BAR_ICON_SIZE = 16;')).toEqual([]);
    expect(unscaledReadLines('  TAB_BAR_ICON_SIZE,')).toEqual([]);
  });
});
