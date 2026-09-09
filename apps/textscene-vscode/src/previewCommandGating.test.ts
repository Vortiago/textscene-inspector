/**
 * The preview command is offered exactly where it opens something.
 *
 * `textscene.openPreviewToSide` accepts `.tscn` and nothing else
 * (`extension.ts`), while the `tscn` LANGUAGE also claims `.tres` so resource
 * files get the same highlighting and diagnostics. A `when` clause written
 * against the language therefore offers the command on files it refuses, and
 * two of them were: the palette entry and the keybinding both read
 * `editorLangId == tscn`, so ctrl+k v on a `.tres` ran the command and got
 * "Open a .tscn file to preview it."
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Contribution {
  readonly command: string;
  readonly when?: string;
}

const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')
) as {
  contributes: {
    menus: Record<string, Contribution[]>;
    keybindings: Contribution[];
  };
};

/** The gate, spelled by the file's extension rather than by its language. */
const GATE = 'resourceExtname == .tscn';

describe('preview command gating', () => {
  const { menus, keybindings } = manifest.contributes;
  const gated = [
    ...Object.entries(menus).flatMap(([menu, items]) =>
      items.map((item) => ({ where: `menus.${menu}`, ...item }))
    ),
    ...keybindings.map((binding) => ({ where: 'keybindings', ...binding })),
  ].filter((entry) => entry.command === 'textscene.openPreviewToSide');

  it('gates every contribution on the extension the command accepts', () => {
    // Four menus and one keybinding. The floor is what stops a manifest
    // reshuffle this stops finding from reading as "every clause is correct".
    expect(gated.length).toBeGreaterThanOrEqual(5);
    const wrong = gated.filter((e) => e.when !== GATE).map((e) => `${e.where}: ${e.when}`);
    expect(wrong).toEqual([]);
  });
});
