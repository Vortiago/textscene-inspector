/**
 * An instance of a scene that Godot refuses to instantiate is a failed load: the node stays as
 * authored, with its own children, and nothing of the refused scene is below it
 * (`packed_scene.cpp:207`, `:218-220`, `:171`, `:232`, `:265`).
 */
import { describe, expect, it } from 'vitest';
import {
  liveTreeOfText,
  livePathsOf,
  mainInstancing,
  TWO_PARENTLESS_ROOTS as TWO_ROOTS,
} from './liveSceneTree.testkit';
// The Instance root merge parses a sub-scene root with the Node parser when its type has none.
import '../nodes/node/index';
import '../nodes/base/node3d/index';

const HEADER = '[gd_scene format=3]\n\n';

const HOST = mainInstancing('res://scene.tscn');
/** The text of `res://scene.tscn` that instances `res://refused.tscn` as its root, which inherits it. */
const INHERITS_REFUSED = `${HEADER}[ext_resource type="PackedScene" path="res://refused.tscn" id="1"]

[node name="Wrapper" instance=ExtResource("1")]

[node name="Hand" type="Node3D" parent="."]
`;

describe('the live tree below an instance of a refused scene', () => {
  const refusals: [string, string][] = [
    ['two parentless headings', TWO_ROOTS],
    [
      'a first heading with a parent',
      `${HEADER}[node name="One" type="Node3D" parent="."]\n\n[node name="Two" type="Node3D" parent="One"]\n`,
    ],
    [
      'a heading that spells parent=""',
      `${HEADER}[node name="One" type="Node3D"]\n\n[node name="Two" type="Node3D" parent=""]\n`,
    ],
    ['a root with no type and no instance', `${HEADER}[node name="One"]\n`],
    ['no node', HEADER],
  ];

  it.each(refusals)('keeps the node as authored for %s', (_, refused) => {
    const tree = liveTreeOfText(HOST, { 'res://scene.tscn': refused });

    expect(livePathsOf(tree)).toEqual(['Main', 'Main/Body', 'Main/Body/Mark']);
    expect(tree.at('Main/Body')!.step.isMerged).toBe(false);
  });

  it('keeps the node as authored, and composes nothing, for a scene whose root inherits a refused scene', () => {
    const tree = liveTreeOfText(HOST, {
      'res://scene.tscn': INHERITS_REFUSED,
      'res://refused.tscn': TWO_ROOTS,
    });

    expect(livePathsOf(tree)).toEqual(['Main', 'Main/Body', 'Main/Body/Mark']);
    expect(tree.at('Main/Body')!.step.isMerged).toBe(false);
    expect(tree.at('Main/Body/Hand')).toBeNull();
    expect(tree.at('Main/Body/One')).toBeNull();
  });

  it('marks the step of the instance as refused, and no other', () => {
    const tree = liveTreeOfText(HOST, { 'res://scene.tscn': TWO_ROOTS });

    expect(tree.at('Main/Body')!.step.isRefusedInstance).toBe(true);
    expect(tree.at('Main')!.step.isRefusedInstance).toBe(false);
  });

  it('merges the instance of a scene that is not refused', () => {
    const tree = liveTreeOfText(HOST, { 'res://scene.tscn': `${HEADER}[node name="Leaf" type="Node3D"]\n` });

    expect(tree.at('Main/Body')!.step.isMerged).toBe(true);
    expect(tree.at('Main/Body')!.step.isRefusedInstance).toBe(false);
  });

  it('fails only the node that instances the refused scene, inside another instanced scene', () => {
    const holder = `${HEADER}[ext_resource type="PackedScene" path="res://refused.tscn" id="1"]

[node name="Holder" type="Node3D"]

[node name="Bad" parent="." instance=ExtResource("1")]
`;
    const tree = liveTreeOfText(HOST, { 'res://scene.tscn': holder, 'res://refused.tscn': TWO_ROOTS });

    expect(livePathsOf(tree)).toEqual(['Main', 'Main/Body', 'Main/Body/Bad', 'Main/Body/Mark']);
    expect(tree.at('Main/Body')!.step.isMerged).toBe(true);
    expect(tree.at('Main/Body/Bad')!.step.isMerged).toBe(false);
    expect(tree.at('Main/Body/Bad')!.step.isRefusedInstance).toBe(true);
  });
});
