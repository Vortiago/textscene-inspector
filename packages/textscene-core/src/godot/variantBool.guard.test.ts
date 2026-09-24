/**
 * Guard: nothing reads a boolean Godot stores in a Variant by comparing its raw text. {@link boolSlotValue} decides it.
 * `.tscn` is not the boundary: a `project.godot` or `.import` field keeps the type the file wrote (`project_settings.cpp:
 * 1320-1325`) and reads into a `bool` through `Variant::booleanize` (`variant_op.cpp:1114-1122`), so `=0` disables a setting.
 * `visible = 0` hides a node (`variant.cpp:550-558`). A raw comparison misses it silently, in opposite directions per spelling.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // .../src

/**
 * Files whose comparison is about a value that is not a boolean slot, the one case a raw comparison is right. Each is a
 * different kind: a DOM attribute this code wrote, an environment variable, an untyped Variant keyframe where booleanizing
 * `1` would make every scalar track a constant `true`, and a BBCode option the engine matches as text.
 */
const NOT_A_BOOL_SLOT: Record<string, string> = {
  'r3f/components/SceneTreeViewer/SceneTreeViewer.tsx': 'aria-expanded, a DOM attribute',
  'r3f/internalTextLabel.tsx': 'the VITEST environment variable',
  'nodes/animation/animationplayer/keyframeValues.ts': 'an untyped Variant keyframe value',
  'godot/variantBool.ts': 'the definition itself',
  'r3f/controls/native/text/sceneFontLoader.ts': 'the VITEST environment variable',
  'nodes/2d/ui/richtextlabel/bbcode.ts':
    'a BBCode tag option, which Godot itself compares against the literal text (rich_text_label.cpp:6138)',
};

function sourceFiles(dir: string = src, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === 'testing') continue;
      found.push(...sourceFiles(resolve(dir, entry.name), `${name}/`));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$|\.testkit\.ts$/.test(entry.name)) {
      found.push(name);
    }
  }
  return found;
}

/** `=== 'true'` and its three siblings, the shapes that read the text directly. */
const RAW_COMPARISON = /(?:===|!==)\s*'(?:true|false)'/;

describe('boolean properties are read through the engine conversion', () => {
  it('finds no raw text comparison outside the allowlist', () => {
    const offenders = sourceFiles()
      .filter((file) => !(file in NOT_A_BOOL_SLOT))
      .filter((file) => RAW_COMPARISON.test(readFileSync(resolve(src, file), 'utf8')));

    expect(
      offenders,
      `A Godot boolean is not its text: an int or float spelling converts into ` +
        `the slot (variant.cpp:550-558) and a ConfigFile field booleanizes on ` +
        `the read (variant_op.cpp:1114-1122), so '0' is false either way. Read ` +
        `it with boolSlotValue from src/godot/variantBool.ts. If the value is ` +
        `one Godot never booleanizes, add it to NOT_A_BOOL_SLOT with the reason:\n` +
        offenders.join('\n')
    ).toEqual([]);
  });

  it('sweeps a population that cannot quietly empty', () => {
    // The filter above is a path match, so a moved file would silently drop out
    // of the scan rather than failing it.
    expect(sourceFiles().length).toBeGreaterThan(800);
    for (const file of Object.keys(NOT_A_BOOL_SLOT)) {
      expect(sourceFiles(), `allowlisted ${file} is no longer a source file`).toContain(file);
    }
  });

  it('sees a raw comparison when one is there', () => {
    // The guard is only worth its runtime if it fails on the shape it bans.
    expect(RAW_COMPARISON.test("if (props.visible !== 'false') {")).toBe(true);
    expect(RAW_COMPARISON.test("if (boolSlotValue(props.visible) !== false) {")).toBe(false);
  });
});
