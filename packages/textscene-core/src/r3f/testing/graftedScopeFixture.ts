/**
 * A host scene that grafts a node into an instanced sub-scene, where both files declare
 * ExtResource "2" for a different scene. A reader that resolves the grafted node's ref in
 * the sub-scene's pool loads `Button`, not the host's `Label`.
 */
import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene } from '../../parser/types';
import type { LiveTreeContext } from '../liveSceneTree';
import { contextOver } from '../liveSceneTree.testkit';
import '../../nodes/node/index';

const parse = (source: string): TscnScene => new TscnParser().parse(source);

export const HOST_LEAF_PATH = 'res://host-leaf.tscn';
export const SUB_LEAF_PATH = 'res://sub-leaf.tscn';
export const SUB_PATH = 'res://sub.tscn';

/** Instances `sub.tscn` as `Sub`, then grafts `Leaf` (an instance of the host's id "2"),
 * `Caption` and `Pane` under its `Slot`. */
export const hostScene = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="${SUB_PATH}" id="1"]
[ext_resource type="PackedScene" path="${HOST_LEAF_PATH}" id="2"]

[node name="Host" type="Control"]

[node name="Sub" parent="." instance=ExtResource("1")]

[node name="Leaf" parent="Sub/Slot" instance=ExtResource("2")]

[node name="Caption" type="Label" parent="Sub/Slot"]

[node name="Pane" type="SubViewport" parent="Sub/Slot"]

[node name="Panel" type="Panel" parent="Sub/Slot/Pane"]
`);

export const subScene = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="${SUB_LEAF_PATH}" id="2"]

[node name="SubRoot" type="Control"]

[node name="Slot" type="Control" parent="."]
`);

export const hostLeafScene = parse(`[gd_scene format=3]

[node name="HostLeafRoot" type="Label"]
`);

export const subLeafScene = parse(`[gd_scene format=3]

[node name="SubLeafRoot" type="Button"]
`);

/** The path of the live tree's graft, through the merged `Sub`. */
export const LEAF_PATH = 'Host/Sub/Slot/Leaf';
export const CAPTION_PATH = 'Host/Sub/Slot/Caption';

export const scenesByPath: Readonly<Record<string, TscnScene>> = {
  [SUB_PATH]: subScene,
  [HOST_LEAF_PATH]: hostLeafScene,
  [SUB_LEAF_PATH]: subLeafScene,
};

export const graftedContext: LiveTreeContext = contextOver(hostScene, scenesByPath);
