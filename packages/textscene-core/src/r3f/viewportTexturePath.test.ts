/**
 * `viewport_path` counts from the **local scene root**, while a `<SubViewport>`
 * publishes under its dispatcher-absolute path (`NodeDispatcher` starts each top-level
 * node at `path={node.name}`). `viewportTextureRegistryKey` converts one to the other.
 */
import { describe, expect, it } from 'vitest';

import { viewportTextureRegistryKey } from './viewportTexturePath';

describe('viewportTextureRegistryKey', () => {
  /** The consumer's dispatcher path starts at the scene root, so its first segment is the root's name. */
  it('rebases a root-relative viewport path onto the consumer scene root', () => {
    expect(viewportTextureRegistryKey('Root/Screen', 'SubViewport')).toBe('Root/SubViewport');
  });

  it('rebases a nested viewport path', () => {
    expect(viewportTextureRegistryKey('Match/UI/Minimap', 'FogOfWar/CombinedViewport')).toBe(
      'Match/FogOfWar/CombinedViewport'
    );
  });

  /** A consumer that is the root (a single-node scene) still rebases onto itself. */
  it('handles a consumer at the scene root', () => {
    expect(viewportTextureRegistryKey('Root', 'SubViewport')).toBe('Root/SubViewport');
  });

  /**
   * Outside a `NodePathProvider` there is no scene root to rebase against, so
   * the texture resolves to nothing rather than to a wrong key.
   */
  it('returns null without a consumer path', () => {
    expect(viewportTextureRegistryKey(null, 'SubViewport')).toBeNull();
  });

  it('returns null for an empty viewport path', () => {
    expect(viewportTextureRegistryKey('Root/Screen', '')).toBeNull();
  });

  /** `/root/…` measures from the live SceneTree, which a static parse does not model. */
  it('returns null for an absolute path', () => {
    expect(viewportTextureRegistryKey('Root/Screen', '/root/Main/SubViewport')).toBeNull();
  });

  /**
   * `get_node_or_null` walks the path (viewport.cpp:198), so a spelling that walks to the same
   * node gives the same key. `.` names the scene root itself.
   */
  it.each([
    ['.', 'Root'],
    ['./SubViewport', 'Root/SubViewport'],
    ['Frame/../SubViewport', 'Root/SubViewport'],
    ['Hud//View', 'Root/Hud/View'],
    ['SubViewport:size', 'Root/SubViewport'],
  ])('walks %s to the node it names', (viewportPath, key) => {
    expect(viewportTextureRegistryKey('Root/Screen', viewportPath)).toBe(key);
  });

  it('returns null for a `..` above the scene root', () => {
    expect(viewportTextureRegistryKey('Root/Screen', '..')).toBeNull();
  });

  /**
   * `%Name` is a jump: `get_node_or_null` looks the name up in the owner's claim
   * table and descends from the claimant.
   */
  describe('a %Name segment', () => {
    const claimed: ReadonlyMap<string, string> = new Map([
      ['%Hud', 'Root/UI/Hud'],
      ['%View', 'Root/UI/Hud/CombinedViewport'],
    ]);

    it('descends from the claimant for a compound path', () => {
      expect(viewportTextureRegistryKey('Root/Screen', '%Hud/CombinedViewport', claimed)).toBe(
        'Root/UI/Hud/CombinedViewport'
      );
    });

    it('resolves a bare %Name to the claimant, where the viewport publishes its real path', () => {
      expect(viewportTextureRegistryKey('Root/Screen', '%View', claimed)).toBe(
        'Root/UI/Hud/CombinedViewport'
      );
    });

    /**
     * The table is the consumer's owner's, and a name it lacks addresses nothing
     * (node.cpp:1930-1938), even where another owner claims it, such as an instanced
     * sub-scene's `%Inner`.
     */
    it('resolves to nothing for a %Name the table has no entry for', () => {
      expect(viewportTextureRegistryKey('Root/Screen', '%Inner', claimed)).toBeNull();
    });

    /** With no table, a `%Name` addresses nothing, as a name the table lacks does. */
    it('resolves to nothing for a %Name with no table at all', () => {
      expect(viewportTextureRegistryKey('Root/Screen', '%View')).toBeNull();
    });
  });
});
