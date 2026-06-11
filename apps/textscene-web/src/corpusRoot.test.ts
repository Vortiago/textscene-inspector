/**
 * corpusRootFor — which public/fixtures subtree a fixture file's res://
 * namespace maps onto. Manifest entries carry it; unlisted demo subscenes
 * (deep links — the selector only lists each demo's main scene) derive it
 * from their demos/<top>/<project>/ prefix.
 */
import { describe, it, expect } from 'vitest';
import { corpusRootFor, fixtureUrlForRes } from './corpusRoot';
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

  it('falls back to the fixtures root for everything else', () => {
    expect(corpusRootFor('dungeon.tscn', manifest)).toBe('');
    expect(corpusRootFor('', manifest)).toBe('');
    expect(corpusRootFor('demos/2d', manifest)).toBe('');
  });
});

describe('fixtureUrlForRes', () => {
  it('maps res:// URLs onto the fixtures mirror under the active root', () => {
    expect(fixtureUrlForRes('res://art/player.png', 'demos/2d/platformer')).toBe(
      '/fixtures/demos/2d/platformer/art/player.png'
    );
    expect(fixtureUrlForRes('res://tileset/tiles.png', '')).toBe('/fixtures/tileset/tiles.png');
  });

  it('decodes URI-encoded glTF dependency paths (textures%2Fgrass.webp)', () => {
    // glTF URIs are percent-encoded per spec; the mirrored files use real
    // directory separators.
    expect(fixtureUrlForRes('res://town/textures%2Fgrass_lossy.webp', 'demos/3d/truck_town')).toBe(
      '/fixtures/demos/3d/truck_town/town/textures/grass_lossy.webp'
    );
  });

  it('passes non-res URLs through untouched', () => {
    expect(fixtureUrlForRes('blob:abc', 'demos/2d/x')).toBe('blob:abc');
    expect(fixtureUrlForRes('/already/mapped.png', '')).toBe('/already/mapped.png');
  });
});
