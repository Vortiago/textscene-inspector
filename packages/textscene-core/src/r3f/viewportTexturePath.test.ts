/**
 * The two coordinate systems a ViewportTexture has to bridge.
 *
 * `viewport_path` is authored relative to the **local scene root** (which is
 * why such a material sets `resource_local_to_scene = true`), but the registry
 * a `<SubViewport>` publishes into is keyed by the DISPATCHER-ABSOLUTE path —
 * root = the root node's own name, children joined with `/`
 * (`NodeDispatcher` dispatches each top-level node at `path={node.name}`).
 * `resolveViewportTexturePath` returns the former; the registry needs the
 * latter, and this is the one function that converts.
 */
import { describe, expect, it } from 'vitest';

import { viewportTextureRegistryKey } from './viewportTexturePath';

describe('viewportTextureRegistryKey', () => {
  /**
   * The consumer's own dispatcher path starts at the scene root, so its first
   * segment IS the root's name — no extra context needed to find it.
   */
  it('rebases a root-relative viewport path onto the consumer scene root', () => {
    expect(viewportTextureRegistryKey('Root/Screen', 'SubViewport')).toBe('Root/SubViewport');
  });

  it('rebases a nested viewport path', () => {
    expect(viewportTextureRegistryKey('Match/UI/Minimap', 'FogOfWar/CombinedViewport')).toBe(
      'Match/FogOfWar/CombinedViewport'
    );
  });

  /** A consumer that IS the root (a single-node scene) still rebases onto itself. */
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

  /**
   * `NodePath(".")` names the viewport itself. It is not a child path, and
   * joining it would key the registry at a literal `Root/.` that nothing ever
   * publishes.
   */
  it('resolves a self-referencing "." to the scene root itself', () => {
    expect(viewportTextureRegistryKey('Root/Screen', '.')).toBe('Root');
  });
});
