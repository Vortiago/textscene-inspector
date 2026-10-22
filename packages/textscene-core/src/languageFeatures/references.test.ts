/** Find All References for a `res://` path: every exact occurrence in the project's text resources. */

import { describe, it, expect } from 'vitest';
import { LanguageDocument } from './document';
import { resPathReferencesAt, type ReferenceSource } from './references';

/** The cursor's own file: the path sits in the heading on line 2, columns 37 to 60. */
const CURSOR_SCENE = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://textures/grid.png" id="1_grid"]
`;
const ON_TARGET = { line: 2, character: 40 };

/** A source over files held in memory, which records every read. A null text is a file the host cannot read. */
function memorySource(files: Record<string, string | null>): ReferenceSource & { readonly reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    listPaths: () => Promise.resolve(Object.keys(files)),
    readText: (path) => {
      reads.push(path);
      return Promise.resolve(files[path] ?? null);
    },
  };
}

/** The references of the path under the cursor in `CURSOR_SCENE`, as `file:line:startCharacter`. */
async function referencesFrom(source: ReferenceSource): Promise<string[]> {
  const found = await resPathReferencesAt(new LanguageDocument(CURSOR_SCENE), ON_TARGET, source);
  return found.map(({ file, range }) => `${file}:${range.start.line}:${range.start.character}`);
}

describe('resPathReferencesAt', () => {
  it('lists the path in every scene and resource that names it, in listing order', async () => {
    const source = memorySource({
      'res://main.tscn': CURSOR_SCENE,
      'res://other.tscn': `[gd_scene format=3]\n\n[ext_resource path="res://textures/grid.png" id=1]\n`,
      'res://style.tres': `[gd_resource type="Resource" format=3]\n\n[resource]\nmetadata/icon = Resource("res://textures/grid.png")\n`,
    });

    expect(await referencesFrom(source)).toEqual([
      'res://main.tscn:2:37',
      'res://other.tscn:2:20',
      'res://style.tres:3:26',
    ]);
  });

  it('reports each occurrence in a file, with its range', async () => {
    const twice = `a = "res://textures/grid.png"\nb = "res://textures/grid.png"\n`;

    const found = await resPathReferencesAt(
      new LanguageDocument(CURSOR_SCENE),
      ON_TARGET,
      memorySource({ 'res://twice.tscn': twice })
    );

    expect(found).toEqual([
      {
        file: 'res://twice.tscn',
        range: { start: { line: 0, character: 5 }, end: { line: 0, character: 28 } },
      },
      {
        file: 'res://twice.tscn',
        range: { start: { line: 1, character: 5 }, end: { line: 1, character: 28 } },
      },
    ]);
  });

  it('matches the whole path, never a longer path that starts or ends with it', async () => {
    const source = memorySource({
      'res://longer.tscn': 'a = "res://textures/grid.png.import"\n',
      'res://deeper.tscn': 'a = "res://sub/textures/grid.png"\n',
      'res://prefix.tscn': 'a = "res://textures/grid.png2"\n',
      'res://other.tscn': 'a = "res://textures/other.png"\n',
    });

    expect(await referencesFrom(source)).toEqual([]);
  });

  it('counts a path in a comment and in prose', async () => {
    const source = memorySource({
      'res://notes.tscn': '; draws res://textures/grid.png here\n[node name="A" type="Node"]\n',
      'res://prose.tscn': 'editor_description = "uses res://textures/grid.png for the floor"\n',
    });

    expect(await referencesFrom(source)).toEqual(['res://notes.tscn:0:8', 'res://prose.tscn:0:27']);
  });

  it('skips a file the host cannot read', async () => {
    const source = memorySource({
      'res://gone.tscn': null,
      'res://kept.tscn': 'a = "res://textures/grid.png"\n',
    });

    expect(await referencesFrom(source)).toEqual(['res://kept.tscn:0:5']);
  });

  it('reads only text resources, in any case of the extension', async () => {
    const source = memorySource({
      'res://textures/grid.png': 'a = "res://textures/grid.png"\n',
      'res://script.gd': 'var a = "res://textures/grid.png"\n',
      'res://UPPER.TSCN': 'a = "res://textures/grid.png"\n',
    });

    expect(await referencesFrom(source)).toEqual(['res://UPPER.TSCN:0:5']);
    expect(source.reads).toEqual(['res://UPPER.TSCN']);
  });

  it('places a range on the right line in a file with Windows line endings', async () => {
    const source = memorySource({
      'res://crlf.tscn': '[gd_scene format=3]\r\n\r\na = "res://textures/grid.png"\r\n',
    });

    expect(await referencesFrom(source)).toEqual(['res://crlf.tscn:2:5']);
  });

  it('gives nothing, and lists nothing, when the cursor is not on a res:// path', async () => {
    let listed = false;
    const source: ReferenceSource = {
      listPaths: () => {
        listed = true;
        return Promise.resolve([]);
      },
      readText: () => Promise.resolve(null),
    };

    const found = await resPathReferencesAt(
      new LanguageDocument(CURSOR_SCENE),
      { line: 0, character: 3 },
      source
    );

    expect(found).toEqual([]);
    expect(listed).toBe(false);
  });

  it('reads many files with a bounded number of reads in flight', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [
        `res://scene${index}.tscn`,
        'a = "res://textures/grid.png"\n',
      ])
    );
    let inFlight = 0;
    let mostInFlight = 0;
    const source: ReferenceSource = {
      listPaths: () => Promise.resolve(Object.keys(files)),
      readText: async (path) => {
        inFlight++;
        mostInFlight = Math.max(mostInFlight, inFlight);
        await Promise.resolve();
        inFlight--;
        return files[path] ?? null;
      },
    };

    const found = await resPathReferencesAt(new LanguageDocument(CURSOR_SCENE), ON_TARGET, source);

    expect(found).toHaveLength(200);
    expect(mostInFlight).toBeLessThanOrEqual(32);
  });
});
