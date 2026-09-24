/**
 * The preview command is offered only where it opens something. It accepts `.tscn`
 * alone, while the `tscn` language also claims `.tres`, so a `when` clause on
 * `editorLangId == tscn` offers it on a `.tres` it refuses.
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
    // Four menus and one keybinding. The floor stops a manifest reshuffle that this
    // scan misses from passing as "every clause is correct".
    expect(gated.length).toBeGreaterThanOrEqual(5);
    const wrong = gated.filter((e) => e.when !== GATE).map((e) => `${e.where}: ${e.when}`);
    expect(wrong).toEqual([]);
  });
});
