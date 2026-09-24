/**
 * `viewport_path` counts from the **local scene root**, while a `<SubViewport>`
 * publishes under its dispatcher-absolute path (`NodeDispatcher` starts each top-level
 * node at `path={node.name}`). These functions convert one to the other.
 */
import { describe, expect, it } from 'vitest';

import type { TscnNode } from '../parser/types.js';
import { TscnParser } from '../parser/TscnParser.js';
import { mergeInstanceRoot } from '../resources/mergeInstanceRoot.js';
import { uniqueNameClaims } from '../utils/uniqueNames.js';
import { viewportTextureRegistryKey, viewportTextureUniqueNameKey } from './viewportTexturePath';

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

  /** `NodePath(".")` names the viewport itself: a literal `Root/.` join is a key nothing publishes. */
  it('resolves a self-referencing "." to the scene root itself', () => {
    expect(viewportTextureRegistryKey('Root/Screen', '.')).toBe('Root');
  });

  /**
   * `/root/…` measures from the live SceneTree, which a static parse does not model:
   * a join is a key nothing publishes, and could resolve as a relative descent.
   */
  it('returns null for an absolute path', () => {
    expect(viewportTextureRegistryKey('Root/Screen', '/root/Main/SubViewport')).toBeNull();
  });

  /**
   * `%Name` is a jump: `get_node_or_null` looks the name up in the owner's claim
   * table and descends from the claimant. A literal `Root/%Hud/CombinedViewport`
   * join is a key nothing registers.
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
     * (node.cpp:1930-1938). The literal join would hit the alias of a sub-viewport
     * under another owner, such as an instanced sub-scene's `%Inner`.
     */
    it('resolves to nothing for a %Name the table has no entry for', () => {
      expect(viewportTextureRegistryKey('Root/Screen', '%Inner', claimed)).toBeNull();
    });

    /** Outside the shell there is no tree, so the alias is all there is. */
    it('falls back to the literal join with no table at all', () => {
      expect(viewportTextureRegistryKey('Root/Screen', '%View')).toBe('Root/%View');
    });
  });
});

/** The `%Name` spelling is a claim, and Godot resolves competing claims before anything can address one. */
describe('viewportTextureUniqueNameKey', () => {
  // Parsed, never hand-built: `unique_name_in_owner` reaches `rawProperties` through
  // the parser, and a hand-built node would only confirm its author's assumed shape.
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

  const claims = uniqueNameClaims(roots);

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
    // Instanced sub-scene content is absent from the authored table, and its owner is
    // the sub-scene's root, so absent is not losing. The table must be populated: an
    // empty one restates the test above and leaves `claims.size > 0 &&
    // !claims.has(key)` free to return null here.
    const [inner] = new TscnParser().parse(`[gd_scene format=3]

[node name="Inner" type="SubViewport"]
unique_name_in_owner = true
`).nodes;
    expect(claims.has('%Inner')).toBe(false);
    expect(viewportTextureUniqueNameKey(inner!, 'Root/Player/Inner', claims)).toBe('Root/%Inner');
  });

  /**
   * The Instance root merge (ADR-0013) returns a fresh node, and the graft of a deep
   * host child copies it, so the publisher never holds the table's object.
   */
  it('publishes for a claimant the Instance root merge rebuilt', () => {
    const host = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://mini.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="MiniMap" parent="." instance=ExtResource("1")]
unique_name_in_owner = true
`);
    const subScene = new TscnParser().parse(`[gd_scene format=3]

[node name="View" type="SubViewport"]
`);
    const authored = host.nodes[0]!.children[0]!;
    const merged = mergeInstanceRoot(authored, subScene, {
      externalResources: host.externalResources,
      internalResources: host.internalResources,
    })!;
    expect(merged).not.toBe(authored);
    expect(merged.type).toBe('SubViewport');

    const hostClaims = uniqueNameClaims(host.nodes);
    expect(viewportTextureUniqueNameKey(merged, 'Root/MiniMap', hostClaims)).toBe('Root/%MiniMap');
  });

  it('publishes for a sole claimant grafted into instanced content', () => {
    const host = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://bike.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Bike" parent="." instance=ExtResource("1")]

[node name="View" type="SubViewport" parent="Bike/Body"]
unique_name_in_owner = true
`);
    const subScene = new TscnParser().parse(`[gd_scene format=3]

[node name="BikeRoot" type="Node2D"]

[node name="Body" type="Node2D" parent="."]
`);
    const bike = host.nodes[0]!.children[0]!;
    const merged = mergeInstanceRoot(bike, subScene, {
      externalResources: host.externalResources,
      internalResources: host.internalResources,
    })!;
    const grafted = merged.children
      .find((child) => child.name === 'Body')!
      .children.find((child) => child.name === 'View')!;

    const hostClaims = uniqueNameClaims(host.nodes);
    // The render path carries the grafted `Body` segment the authored one lacks.
    expect(hostClaims.get('%View')?.path).toBe('Root/Bike/View');
    expect(viewportTextureUniqueNameKey(grafted, 'Root/Bike/Body/View', hostClaims)).toBe(
      'Root/%View'
    );
  });
});
