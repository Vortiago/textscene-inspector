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

import type { TscnNode } from '../parser/types.js';
import { TscnParser } from '../parser/TscnParser.js';
import { uniqueNamePaths } from '../utils/uniqueNames.js';
import { viewportTextureRegistryKey, viewportTextureUniqueNameKey } from './viewportTexturePath';

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

/**
 * The `%Name` spelling is a CLAIM, and Godot resolves competing claims before
 * anything can address one.
 */
describe('viewportTextureUniqueNameKey', () => {
  // Parsed, never hand-built: `unique_name_in_owner` reaches `rawProperties`
  // through the parser, and a node literal written here would only confirm the
  // shape its author had in mind (`utils/uniqueNames.test.ts` says the same).
  const roots = new TscnParser().parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Ui" type="Node2D" parent="."]

[node name="View" type="SubViewport" parent="Ui"]
unique_name_in_owner = true

[node name="Hud" type="Node2D" parent="."]

[node name="View" type="Control" parent="Hud"]
unique_name_in_owner = true

[node name="Plain" type="SubViewport" parent="."]
`).nodes;

  const claims = uniqueNamePaths(roots);

  /** The node at a dispatcher-absolute path. By path, since two are named `View`. */
  function at(path: string): TscnNode {
    let level = roots;
    let found: TscnNode | undefined;
    for (const name of path.split('/')) {
      found = level.find((n) => n.name === name);
      level = found?.children ?? [];
    }
    return found!;
  }

  it('publishes the alias for the node that claimed the name', () => {
    expect(viewportTextureUniqueNameKey(at('Root/Ui/View'), 'Root/Ui/View', claims)).toBe(
      'Root/%View'
    );
  });

  it('publishes nothing for a later node whose flag Godot cleared', () => {
    // `_acquire_unique_name_in_owner` refuses to overwrite an existing entry
    // and clears the loser's own flag (node.cpp:2225-2231), so `%View` names
    // the first claimant and this one is addressable only by its path.
    expect(
      viewportTextureUniqueNameKey(at('Root/Hud/View'), 'Root/Hud/View', claims)
    ).toBeNull();
  });

  it('publishes nothing for a node that never claimed a unique name', () => {
    expect(viewportTextureUniqueNameKey(at('Root/Plain'), 'Root/Plain', claims)).toBeNull();
  });

  it('trusts the flag when no claim table is in hand', () => {
    // Mounted outside the shell there is no authored tree to resolve against,
    // and the node's own flag is the whole of what is knowable.
    expect(viewportTextureUniqueNameKey(at('Root/Ui/View'), 'Root/Ui/View')).toBe('Root/%View');
  });

  it('publishes for a claimant the table does not cover', () => {
    // Content composed in from an INSTANCED sub-scene is not in the authored
    // roots the table is built from, and its own owner is that sub-scene's
    // root — absent from the table is not the same as losing the claim.
    expect(viewportTextureUniqueNameKey(at('Root/Ui/View'), 'Root/Ui/View', new Map())).toBe(
      'Root/%View'
    );
  });
});
