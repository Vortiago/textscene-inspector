/**
 * `parentTypeVerdict`'s three ways of not knowing.
 *
 * The union exists so a rule has to choose deliberately between them, and the
 * arm that matters most is `unknowable`: getting it wrong means announcing a
 * defect in a scene the linter cannot actually see into.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import { StrictTscnParser } from './StrictTscnParser.js';
import { parentTypeVerdict, placementPhrase, visibleInTreeVerdict } from './parentType.js';
import type { TscnNode } from '../parser/types.js';

function parse(source: string) {
  return new TscnParser().parse(source);
}

/** Depth-first lookup by name, since these trees are tiny. */
function byName(nodes: readonly TscnNode[], name: string): TscnNode {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = n.children?.length ? byName(n.children, name) : undefined;
    if (hit) return hit;
  }
  throw new Error(`no node named ${name}`);
}

describe('parentTypeVerdict', () => {
  it('is satisfied by the wanted type, and carries the parent', () => {
    const scene = parse(
      `[gd_scene format=3]

[node name="Skel" type="Skeleton3D"]

[node name="Mod" type="AimModifier3D" parent="."]
`
    );
    const verdict = parentTypeVerdict(scene, byName(scene.nodes, 'Mod'), 'Skeleton3D');
    expect(verdict.kind).toBe('satisfied');
    expect(verdict.kind === 'satisfied' && verdict.parent.name).toBe('Skel');
  });

  it('is satisfied by a subclass, not just the exact name', () => {
    const scene = parse(
      `[gd_scene format=3]

[node name="Body" type="RigidBody3D"]

[node name="Shape" type="CollisionShape3D" parent="."]
`
    );
    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Shape'), 'CollisionObject3D').kind).toBe(
      'satisfied'
    );
  });

  it('separates a parentless root from a wrong parent', () => {
    const scene = parse(
      `[gd_scene format=3]

[node name="Lonely" type="AimModifier3D"]
`
    );
    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Lonely'), 'Skeleton3D').kind).toBe('root');

    const mismatched = parse(
      `[gd_scene format=3]

[node name="Holder" type="Node3D"]

[node name="Mod" type="AimModifier3D" parent="."]
`
    );
    const verdict = parentTypeVerdict(mismatched, byName(mismatched.nodes, 'Mod'), 'Skeleton3D');
    expect(verdict.kind).toBe('mismatch');
    expect(placementPhrase(verdict)).toBe('a child of a Node3D node');
  });

  it('cannot know the type of an instanced parent', () => {
    const scene = parse(
      `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://char.tscn" id="1"]

[node name="Char" instance=ExtResource("1")]

[node name="Mod" type="AimModifier3D" parent="."]
`
    );
    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Mod'), 'Skeleton3D').kind).toBe(
      'unknowable'
    );
  });

  it('cannot know the type of a parent that only OVERRIDES one inside an instance', () => {
    // The regression this file was written for. A heading with neither `type=`
    // nor `instance=` overrides a node already present inside an instanced
    // ancestor, and its real type lives in that other scene. But
    // `NodeRegistry.ts:109` defaults a missing type to `'Node'`, so a check of
    // `!parent.type` sees a confident `'Node'` and answers `mismatch` — which
    // made the linter report a misplaced skeleton modifier in Godot's own
    // shipped ragdoll demo.
    const scene = parse(
      `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://mannequiny.tscn" id="1"]

[node name="Mannequiny" instance=ExtResource("1")]

[node name="Skeleton3D" parent="." index="0"]

[node name="Sim" type="PhysicalBoneSimulator3D" parent="Skeleton3D" index="1"]
`
    );
    const parent = byName(scene.nodes, 'Skeleton3D');
    expect(parent.overridesExistingNode).toBe(true);
    expect(parent.type).toBe('Node'); // the default that made the old check lie

    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Sim'), 'Skeleton3D').kind).toBe(
      'unknowable'
    );
  });
});

/**
 * The two families walk different chains, and both stop early. A uniform walk of
 * every ancestor's `visible` key answers `hidden` for trees Godot draws.
 */
describe('visibleInTreeVerdict', () => {
  // The strict parser, not the lenient one: it is what feeds the rules, and it
  // keeps property values as the file's own strings, which is what
  // `isExplicitlyHidden` reads.
  function verdictOf(source: string, name: string) {
    const scene = new StrictTscnParser().parse(source).scene;
    if (!scene) throw new Error('the scanner produced no scene');
    return visibleInTreeVerdict(scene, byName(scene.nodes, name));
  }

  describe('Node3D', () => {
    it('is hidden by its own key, and by a Node3D ancestor', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Follow" type="PathFollow3D" parent="."]
visible = false
`,
          'Follow'
        )
      ).toBe('hidden');

      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node3D"]
visible = false

[node name="Mid" type="Node3D" parent="."]

[node name="Follow" type="PathFollow3D" parent="Mid"]
`,
          'Follow'
        )
      ).toBe('hidden');
    });

    it('stops at the first non-Node3D ancestor, so a hidden Node3D above it does not count', () => {
      // node_3d.cpp:150 casts the parent to Node3D and stores null otherwise, so
      // the plain Node ends the chain and the hidden root is never read.
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node3D"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Follow" type="PathFollow3D" parent="Plain"]
`,
          'Follow'
        )
      ).toBe('visible');
    });

    it('cannot know an instanced ancestor inside the chain', () => {
      expect(
        verdictOf(
          `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Rig" instance=ExtResource("1")]

[node name="Follow" type="PathFollow3D" parent="."]
`,
          'Follow'
        )
      ).toBe('unknowable');
    });

    it('ignores an instanced ancestor the chain never reaches', () => {
      expect(
        verdictOf(
          `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Rig" instance=ExtResource("1")]

[node name="Plain" type="Node" parent="."]

[node name="Follow" type="PathFollow3D" parent="Plain"]
`,
          'Follow'
        )
      ).toBe('visible');
    });
  });

  describe('CanvasItem', () => {
    it('cascades through the contiguous CanvasItem run', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Region" type="NavigationRegion2D" parent="."]
`,
          'Region'
        )
      ).toBe('hidden');
    });

    it('stops at a plain Node, so a hidden Node2D above it does not count', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Plain"]
`,
          'Region'
        )
      ).toBe('visible');
    });

    it('reads a CanvasLayer parent, but only as the immediate parent', () => {
      const layer = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Layer" type="CanvasLayer" parent="."]
visible = false
`;
      expect(verdictOf(`${layer}
[node name="Region" type="NavigationRegion2D" parent="Layer"]
`, 'Region')).toBe('hidden');

      // canvas_item.cpp:324-328 casts the IMMEDIATE parent only, so one plain
      // Node between them and the layer contributes nothing.
      expect(verdictOf(`${layer}
[node name="Plain" type="Node" parent="Layer"]

[node name="Region" type="NavigationRegion2D" parent="Layer/Plain"]
`, 'Region')).toBe('visible');
    });

    it('reads a hidden Window found by the Viewport search, across plain Nodes', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Dialog" type="Window"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Plain"]
`,
          'Region'
        )
      ).toBe('hidden');
    });

    it('treats any other Viewport ancestor as visible', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Port" type="SubViewport" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Port"]
`,
          'Region'
        )
      ).toBe('visible');
    });

    it('cannot rule out a hidden Window behind an instanced ancestor', () => {
      // Unlike Node3D, the search climbs past whatever is not a Viewport, so an
      // instanced ancestor above the CanvasItem run is still consulted.
      expect(
        verdictOf(
          `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://dialog.tscn" id="1"]

[node name="Dialog" instance=ExtResource("1")]

[node name="Plain" type="Node" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Plain"]
`,
          'Region'
        )
      ).toBe('unknowable');
    });
  });

  it('leaves a node in neither family visible: it has no is_visible_in_tree()', () => {
    expect(
      verdictOf(
        `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Player" type="AnimationPlayer" parent="."]
`,
        'Player'
      )
    ).toBe('visible');
  });
});
