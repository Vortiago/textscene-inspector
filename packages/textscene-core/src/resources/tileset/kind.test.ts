/**
 * The TileSet kinds read a TileSet and each of its sources the same way from the scene and from a
 * file (`tile_set.cpp:3961-3968`), and a reference written in a source resolves in the tables of
 * the file that holds the source.
 */
import { describe, expect, it } from 'vitest';
import { referenceKey, snapshotOver } from '../reading';
import { nodeReference } from '../reading/scopedReference';
import { sceneTables } from '../reading/reading.testkit';
import { staticSnapshot } from '../reading/staticSnapshot.testkit';
import type { Read } from '../reading/read';
import { TILE_SET } from './kind';
import type { TileSetModel } from './types';

const ATLAS_BODY = `texture = ExtResource("tex")
texture_region_size = Vector2i(32, 24)
0:0/0 = 0`;

const SCENES_BODY = `scenes/1/scene = ExtResource("scene")
scenes/1/display_placeholder = true`;

/** The source `body` of class `className` as `sources/0` of a TileSet, from each origin. */
function origins(className: string, body: string, tables: string) {
  const inline = {
    scene: `${tables}

[sub_resource type="${className}" id="source"]
${body}

[sub_resource type="TileSet" id="ts"]
sources/0 = SubResource("source")`,
    ref: 'SubResource("ts")',
    files: {},
  };
  const sourceFile = {
    scene: `[ext_resource type="${className}" path="res://source.tres" id="src"]

[sub_resource type="TileSet" id="ts"]
sources/0 = ExtResource("src")`,
    ref: 'SubResource("ts")',
    files: {
      'res://source.tres': `[gd_resource type="${className}" format=3]\n\n${tables}\n\n[resource]\n${body}\n`,
    },
  };
  const tileSetFile = {
    scene: '[ext_resource type="TileSet" path="res://tile_set.tres" id="ts"]',
    ref: 'ExtResource("ts")',
    files: {
      'res://tile_set.tres': `[gd_resource type="TileSet" format=3]

${tables}

[sub_resource type="${className}" id="source"]
${body}

[resource]
sources/0 = SubResource("source")
`,
    },
  };
  return { inline, sourceFile, tileSetFile };
}

function readTileSet({ scene, ref, files }: { scene: string; ref: string; files: Record<string, string> }) {
  return staticSnapshot(files).read(nodeReference(ref, sceneTables(scene)), TILE_SET);
}

function loaded(read: Read<TileSetModel>): TileSetModel {
  if (read.status !== 'loaded') throw new Error(`expected the TileSet to load, got ${read.status}`);
  return read.value;
}

/** The atlas source with its texture as the file it names, so the origins compare. */
function atlasSummary(model: TileSetModel) {
  const source = model.sources.get(0);
  if (!source) return null;
  const { texture, ...rest } = source;
  return { ...rest, texture: texture && referenceKey(texture) };
}

function sceneSummary(model: TileSetModel) {
  return model.sceneSources.get(0)?.scenes.get(1) ?? null;
}

describe('a TileSetAtlasSource', () => {
  const cases = origins(
    'TileSetAtlasSource',
    ATLAS_BODY,
    '[ext_resource type="Texture2D" path="res://tiles.png" id="tex"]'
  );

  it('decodes in a sub-resource of the scene', () => {
    expect(atlasSummary(loaded(readTileSet(cases.inline)))).toMatchObject({
      texture: 'res://tiles.png',
      textureRegionSize: { x: 32, y: 24 },
    });
  });

  it('decodes the same in a .tres of its own', () => {
    expect(atlasSummary(loaded(readTileSet(cases.sourceFile)))).toEqual(
      atlasSummary(loaded(readTileSet(cases.inline)))
    );
  });

  it('decodes the same with the TileSet in a .tres', () => {
    expect(atlasSummary(loaded(readTileSet(cases.tileSetFile)))).toEqual(
      atlasSummary(loaded(readTileSet(cases.inline)))
    );
  });

  it('resolves its texture in the tables of the file that holds it', () => {
    const scene = `[ext_resource type="Texture2D" path="res://scene_tiles.png" id="tex"]\n\n${cases.sourceFile.scene}`;
    const model = loaded(readTileSet({ ...cases.sourceFile, scene }));
    expect(atlasSummary(model)?.texture).toBe('res://tiles.png');
  });

  it('makes the TileSet wait while the file of its source loads', () => {
    const stillLoading = snapshotOver({ getCached: () => undefined });
    const read = stillLoading.read(
      nodeReference(cases.sourceFile.ref, sceneTables(cases.sourceFile.scene)),
      TILE_SET
    );
    expect(read.status).toBe('pending');
  });
});

describe('a TileSetScenesCollectionSource', () => {
  const cases = origins(
    'TileSetScenesCollectionSource',
    SCENES_BODY,
    '[ext_resource type="PackedScene" path="res://tile.tscn" id="scene"]'
  );

  it('decodes in a sub-resource of the scene', () => {
    expect(sceneSummary(loaded(readTileSet(cases.inline)))).toEqual({
      scene: { path: 'res://tile.tscn' },
      displayPlaceholder: true,
    });
  });

  it('decodes the same in a .tres of its own', () => {
    expect(sceneSummary(loaded(readTileSet(cases.sourceFile)))).toEqual(
      sceneSummary(loaded(readTileSet(cases.inline)))
    );
  });

  it('decodes the same with the TileSet in a .tres', () => {
    expect(sceneSummary(loaded(readTileSet(cases.tileSetFile)))).toEqual(
      sceneSummary(loaded(readTileSet(cases.inline)))
    );
  });

  it('resolves its scene in the tables of the file that holds it', () => {
    const scene = `[ext_resource type="PackedScene" path="res://scene_tile.tscn" id="scene"]\n\n${cases.sourceFile.scene}`;
    expect(sceneSummary(loaded(readTileSet({ ...cases.sourceFile, scene })))?.scene).toEqual({
      path: 'res://tile.tscn',
    });
  });
});
