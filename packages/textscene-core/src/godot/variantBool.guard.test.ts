/**
 * Guard: nothing reads a boolean Godot stores in a Variant by comparing its
 * raw text.
 *
 * `.tscn` is the common case, and not the boundary. A `project.godot` or
 * `.import` field is parsed into a Variant of whatever type the file wrote
 * (`_GLOBAL_DEF` leaves an already-loaded value alone, `project_settings.cpp:
 * 1320-1325`) and read into a `bool`, which is `Variant::booleanize`
 * (`variant_op.cpp:1114-1122`) — so `=0` disables a setting exactly as `=false`
 * does. "It is a ConfigFile field, not a node property" is therefore not an
 * exemption; only a value Godot never puts in a BOOL context is.
 *
 * `visible = 0` is a file Godot loads, hiding the node — `can_convert_strict`
 * lists INT and FLOAT as valid sources for a BOOL target (`variant.cpp:550-558`)
 * and the write booleanizes. A raw comparison against `'true'`/`'false'` misses
 * that, and the two spellings of the miss fail in OPPOSITE directions: a rule
 * written `=== 'true'` silently stops firing, while a renderer written
 * `!== 'false'` draws a node Godot hides. Neither shows up as a failure
 * anywhere, which is how this survived across all three phases at once.
 *
 * So the readers move together with the fact: {@link boolSlotValue} is the only
 * place the spelling is decided, and this scrapes for anyone rebuilding it.
 *
 * The allowlist is short and each entry is a value that is NOT a boolean
 * property slot — the one case a raw comparison is right.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // .../src

/**
 * Files whose comparison is not about a value Godot ever booleanizes.
 *
 * Each is a different KIND of value, which is why none of them can share the
 * property reader: a DOM attribute this code wrote itself, an environment
 * variable, an untyped Variant keyframe where `1` is the number one and
 * booleanizing it would turn every scalar track into a constant `true`, and a
 * BBCode option the engine itself matches as text.
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
    // of the sweep rather than failing it.
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
