/**
 * Drift guard: a Control whose type the default theme table holds reads each item from `n.colors`,
 * `n.constants` or `n.styleBoxes` with no fallback of its own. The tree build fills those records from the
 * table, so a `?? <default>` on an item the table holds is a second copy of a Godot value.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultThemeAt } from '../../../godot/scene/defaultTheme/defaultTheme';
import { isCommentLine, isProductionSource, reportOffenders, walkSources } from '../../testing/sourceScan';

const SRC_ROOT = join(import.meta.dirname, '../../..');

/** The Control folders whose types the table holds. A later slice of #1436 adds its folders here. */
const MIGRATED_FOLDERS = [
  'button',
  'checkbox',
  'checkbutton',
  'colorpickerbutton',
  'label',
  'linkbutton',
  'menubar',
  'menubutton',
  'optionbutton',
].map((folder) => join(SRC_ROOT, 'nodes/2d/ui', folder));

const BUTTON_BASE = join(SRC_ROOT, 'r3f/controls/native/buttonBase.ts');

const SOURCES = [
  ...walkSources(MIGRATED_FOLDERS, isProductionSource),
  { file: BUTTON_BASE, source: readFileSync(BUTTON_BASE, 'utf8') },
];

type ItemKind = 'colors' | 'constants' | 'styleBoxes';

/** Every item name the table holds for any type, by the record a Control reads it from. */
const HELD_NAMES: Readonly<Record<ItemKind, ReadonlySet<string>>> = (() => {
  const types = Object.values(defaultThemeAt(1).types);
  const namesOf = (pick: (type: (typeof types)[number]) => object) =>
    new Set(types.flatMap((type) => Object.keys(pick(type))));
  return {
    colors: namesOf((type) => type.colors),
    constants: namesOf((type) => type.constants),
    styleBoxes: namesOf((type) => type.styles),
  };
})();

/** `colors['name'] ??` or `colors.name ??`, and the same for `constants` and `styleBoxes`. */
const FALLBACK_READ = /\b(colors|constants|styleBoxes)(?:\[\s*['"`](\w+)['"`]\s*\]|\.(\w+))\s*\?\?/g;

function fallbackLines(source: string): number[] {
  return source.split('\n').flatMap((line, index) => {
    if (isCommentLine(line)) return [];
    const isHeldFallback = [...line.matchAll(FALLBACK_READ)].some(([, kind, bracketName, dotName]) =>
      HELD_NAMES[kind as ItemKind].has((bracketName ?? dotName)!)
    );
    return isHeldFallback ? [index + 1] : [];
  });
}

describe('default theme fallback conformance', () => {
  it('reads every item the table holds with no fallback of its own', () => {
    const offenders = reportOffenders(SOURCES, fallbackLines);
    expect(
      offenders,
      `these lines repeat a default theme value: read it with requiredThemeItem: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('would catch a fallback on an item the table holds, and only on one: the check is not vacuous', () => {
    expect(fallbackLines("  const c = n.colors['font_color'] ?? WHITE;")).toEqual([1]);
    expect(fallbackLines('  const box = n.styleBoxes.normal ?? EMPTY;')).toEqual([1]);
    expect(fallbackLines("  const gap = n.constants['h_separation'] ?? 4;")).toEqual([1]);
    expect(fallbackLines("  const gap = n.constants['paragraph_spacing'] ?? 0;")).toEqual([]);
    expect(fallbackLines("  // n.colors['font_color'] ?? WHITE")).toEqual([]);
  });
});
