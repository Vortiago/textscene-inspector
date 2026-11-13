/**
 * Drift guard: a default theme value has one home, the table in `godot/scene/defaultTheme/`. A source file
 * outside `godot/` that cites `default_theme.cpp` restates a value the table holds, so it names the table
 * entry by type and item instead. The scan reads text: a cite split over two lines escapes it.
 */
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductionSource, walkSources } from '../../../r3f/testing/sourceScan';

const SRC_ROOT = join(import.meta.dirname, '../../..');
const GODOT_ROOT = join(SRC_ROOT, 'godot');

/** Files that may cite `default_theme.cpp`, each with its reason. The table holds no icon or font. */
const ALLOWED: Readonly<Record<string, string>> = {
  'r3f/controls/native/themeIcons.ts': 'default icons, outside the table',
  'r3f/controls/native/scaledSvgIcon.ts': 'default icons, outside the table',
  'nodes/2d/ui/lineedit/icons.ts': 'default icons, outside the table',
  'nodes/2d/ui/spinbox/icons.ts': 'default icons, outside the table',
  'nodes/2d/ui/graphelement/graphIcons.ts': 'default icons, outside the table',
  'nodes/2d/ui/richtextlabel/styleFaces.ts': 'default fonts (ADR-0059), outside the table',
  'r3f/controls/native/text/openSansCanvasFontMetrics.ts': 'default fonts (ADR-0059), outside the table',
  'r3f/controls/native/text/sceneFontResolution.ts': 'default fonts (ADR-0059), outside the table',
};

const CITE = 'default_theme.cpp';

/** `line` numbers, counted from 1, of each line of `source` that holds the cite. */
function citeLines(source: string): number[] {
  return source.split('\n').flatMap((line, index) => (line.includes(CITE) ? [index + 1] : []));
}

const SOURCES = walkSources([SRC_ROOT], isProductionSource)
  .map(({ file, source }) => ({ path: relative(SRC_ROOT, file), source }))
  .filter(({ path }) => !join(SRC_ROOT, path).startsWith(GODOT_ROOT + '/'));

describe('default theme cite conformance', () => {
  it('cites default_theme.cpp only inside godot/ and in the allowed files', () => {
    const offenders = SOURCES.filter(({ path }) => !(path in ALLOWED)).flatMap(({ path, source }) =>
      citeLines(source).map((line) => `${path}:${line}`)
    );
    expect(
      offenders,
      `these lines cite default_theme.cpp: name the table entry by type and item instead: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('allows only files that still cite it, so the list only shrinks', () => {
    const citing = new Set(SOURCES.filter(({ source }) => source.includes(CITE)).map(({ path }) => path));
    expect(Object.keys(ALLOWED).filter((path) => !citing.has(path))).toEqual([]);
  });

  it('would catch a cite: the check is not vacuous', () => {
    expect(citeLines('/** `separation` is 4 (`default_theme.cpp:1250`). */')).toEqual([1]);
    expect(citeLines("/** `separation` is the default theme's `HBoxContainer/separation`. */")).toEqual([]);
  });
});
