/**
 * `viewport_path` counts from the texture's **local scene root**, while a `<SubViewport>`
 * publishes under its dispatcher-absolute path (`NodeDispatcher` starts each top-level
 * node at `path={node.name}`). `viewportTextureRegistryKey` converts one to the other.
 */
import { describe, expect, it } from 'vitest';

import { viewportTextureRegistryKey } from './viewportTexturePath';

describe('viewportTextureRegistryKey', () => {
  it('rebases a root-relative viewport path onto the local scene root', () => {
    expect(viewportTextureRegistryKey('Root', 'SubViewport')).toBe('Root/SubViewport');
  });

  it('rebases a nested viewport path', () => {
    expect(viewportTextureRegistryKey('Match', 'FogOfWar/CombinedViewport')).toBe(
      'Match/FogOfWar/CombinedViewport'
    );
  });

  /**
   * With no local scene root there is nothing to rebase against, so the texture
   * resolves to nothing rather than to a wrong key.
   */
  it('returns null without a local scene root', () => {
    expect(viewportTextureRegistryKey(null, 'SubViewport')).toBeNull();
  });

  it('returns null for an empty viewport path', () => {
    expect(viewportTextureRegistryKey('Root', '')).toBeNull();
  });

  /** `/root/…` measures from the live SceneTree, which a static parse does not model. */
  it('returns null for an absolute path', () => {
    expect(viewportTextureRegistryKey('Root', '/root/Main/SubViewport')).toBeNull();
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
    expect(viewportTextureRegistryKey('Root', viewportPath)).toBe(key);
  });

  it('returns null for a `..` above the scene root', () => {
    expect(viewportTextureRegistryKey('Root', '..')).toBeNull();
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
      expect(viewportTextureRegistryKey('Root', '%Hud/CombinedViewport', claimed)).toBe(
        'Root/UI/Hud/CombinedViewport'
      );
    });

    it('resolves a bare %Name to the claimant, where the viewport publishes its real path', () => {
      expect(viewportTextureRegistryKey('Root', '%View', claimed)).toBe(
        'Root/UI/Hud/CombinedViewport'
      );
    });

    /**
     * The table is the consumer's owner's, and a name it lacks addresses nothing
     * (node.cpp:1930-1938), even where another owner claims it, such as an instanced
     * sub-scene's `%Inner`.
     */
    it('resolves to nothing for a %Name the table has no entry for', () => {
      expect(viewportTextureRegistryKey('Root', '%Inner', claimed)).toBeNull();
    });

    /** With no table, a `%Name` addresses nothing, as a name the table lacks does. */
    it('resolves to nothing for a %Name with no table at all', () => {
      expect(viewportTextureRegistryKey('Root', '%View')).toBeNull();
    });
  });
});
