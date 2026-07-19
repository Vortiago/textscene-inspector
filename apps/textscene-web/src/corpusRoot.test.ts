/**
 * The corpus ↔ res:// boundary: `corpusRootFor` derives which public/fixtures
 * subtree a fixture file maps onto; `resToFixtureFile` / `fixtureFileToRes` are
 * the inverse pair between a res:// path and its fixtures file; `fixtureUrlForRes`
 * / `fixtureUrlForGltfUri` derive the fetch URL (the latter decodes glTF URIs).
 */
import { describe, it, expect } from 'vitest';
import {
  corpusRootFor,
  resToFixtureFile,
  fixtureFileToRes,
  fixtureUrlForRes,
  fixtureUrlForGltfUri,
} from './corpusRoot';
import type { Fixture } from './fixtures';

const manifest: Fixture[] = [
  { name: 'Plane', file: 'unit-plane-mesh.tscn', category: 'Unit' },
  {
    name: 'Platformer (2D)',
    file: 'demos/2d/platformer/game_singleplayer.tscn',
    category: 'Godot Demos - 2D',
    root: 'demos/2d/platformer',
  },
];

describe('corpusRootFor', () => {
  it('uses the manifest root for listed fixtures', () => {
    expect(corpusRootFor('demos/2d/platformer/game_singleplayer.tscn', manifest)).toBe(
      'demos/2d/platformer'
    );
    expect(corpusRootFor('unit-plane-mesh.tscn', manifest)).toBe('');
  });

  it('derives the project root for unlisted demo subscenes (deep links)', () => {
    expect(corpusRootFor('demos/2d/platformer/level/level.tscn', manifest)).toBe(
      'demos/2d/platformer'
    );
    expect(corpusRootFor('demos/3d/physics_tests/tests/functional/test_stack.tscn', manifest)).toBe(
      'demos/3d/physics_tests'
    );
  });

  it('derives the game root for unlisted game subscenes (addons/, deep links)', () => {
    // games/<dir>/ is a 2-segment root (vs demos' 3-segment); addon editor
    // scenes are kept on disk but not listed, so they resolve via the prefix.
    expect(
      corpusRootFor('games/godot-open-rpg/addons/dialogic/Editor/editor.tscn', manifest)
    ).toBe('games/godot-open-rpg');
    expect(corpusRootFor('games/kenney-platformer/objects/player.tscn', manifest)).toBe(
      'games/kenney-platformer'
    );
  });

  it('falls back to the fixtures root for everything else', () => {
    expect(corpusRootFor('dungeon.tscn', manifest)).toBe('');
    expect(corpusRootFor('', manifest)).toBe('');
    expect(corpusRootFor('demos/2d', manifest)).toBe('');
    expect(corpusRootFor('games/kenney-platformer', manifest)).toBe('');
  });
});

describe('resToFixtureFile / fixtureFileToRes (bijection)', () => {
  it('maps a res:// path onto its fixtures file under the active root', () => {
    expect(resToFixtureFile('res://level/level.tscn', 'demos/2d/platformer')).toBe(
      'demos/2d/platformer/level/level.tscn'
    );
    expect(resToFixtureFile('res://unit-plane-mesh.tscn', '')).toBe('unit-plane-mesh.tscn');
  });

  it('prefixes a non-res path as-is (open sub-scene by fixture path)', () => {
    expect(resToFixtureFile('level/level.tscn', 'demos/2d/platformer')).toBe(
      'demos/2d/platformer/level/level.tscn'
    );
  });

  it('recovers the res:// identity of a fixtures file under its root', () => {
    expect(fixtureFileToRes('demos/2d/platformer/level/level.tscn', 'demos/2d/platformer')).toBe(
      'res://level/level.tscn'
    );
    expect(fixtureFileToRes('unit-plane-mesh.tscn', '')).toBe('res://unit-plane-mesh.tscn');
  });

  it('keeps the whole path when the file is outside the active root (uploaded scene)', () => {
    expect(fixtureFileToRes('my-scene.tscn', 'demos/2d/platformer')).toBe('res://my-scene.tscn');
  });

  it('round-trips res:// → fixtures file → res://', () => {
    for (const [res, root] of [
      ['res://art/player.png', 'demos/2d/platformer'],
      ['res://a.tscn', ''],
      ['res://deep/nested/thing.tres', 'games/kenney-platformer'],
    ] as const) {
      expect(fixtureFileToRes(resToFixtureFile(res, root), root)).toBe(res);
    }
  });
});

describe('fixtureUrlForRes', () => {
  it('maps res:// URLs onto the fixtures mirror under the active root', () => {
    expect(fixtureUrlForRes('res://art/player.png', 'demos/2d/platformer')).toBe(
      '/fixtures/demos/2d/platformer/art/player.png'
    );
    expect(fixtureUrlForRes('res://tileset/tiles.png', '')).toBe('/fixtures/tileset/tiles.png');
  });

  it('does NOT decode percent-encoding (raw parser paths have real separators)', () => {
    expect(fixtureUrlForRes('res://town/textures%2Fgrass.webp', 'demos/3d/truck_town')).toBe(
      '/fixtures/demos/3d/truck_town/town/textures%2Fgrass.webp'
    );
  });

  it('passes non-res URLs through untouched', () => {
    expect(fixtureUrlForRes('blob:abc', 'demos/2d/x')).toBe('blob:abc');
    expect(fixtureUrlForRes('/already/mapped.png', '')).toBe('/already/mapped.png');
  });
});

describe('fixtureUrlForGltfUri', () => {
  it('decodes URI-encoded glTF dependency paths (textures%2Fgrass.webp)', () => {
    // glTF URIs are percent-encoded per spec; the mirrored files use real
    // directory separators.
    expect(fixtureUrlForGltfUri('res://town/textures%2Fgrass_lossy.webp', 'demos/3d/truck_town')).toBe(
      '/fixtures/demos/3d/truck_town/town/textures/grass_lossy.webp'
    );
  });

  it('passes non-res URLs through untouched', () => {
    expect(fixtureUrlForGltfUri('blob:abc', 'demos/2d/x')).toBe('blob:abc');
  });
});
