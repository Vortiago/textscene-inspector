import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { TscnParser } from '../../parser/TscnParser';
import { resourceFailingReads, sceneFailingReads, type FailingReadKind } from './fileReads';
import { sceneFailureOf } from './sceneFailure';

interface GodotRow {
  row: number;
  reads: string;
  file: 'tscn' | 'tres';
  text: string;
  /** The reads whose failure fails the file, up to where the parse fails, each with Godot's line for it. */
  failing: { path: string; kind: FailingReadKind; line: number }[];
  /** The line Godot prints where the parse stops, null where the file parses. */
  stop: string | null;
}

/** Each place a file names a resource, as Godot 4.6.3 loads it, measured one file per headless run. */
const ROWS: GodotRow[] = [
  {
    row: 1,
    reads: '[sub_resource] reads an undeclared ExtResource',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = ExtResource("99")

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: "res://row01.tscn:4 - Parse Error: Can't load cached ext-resource id: 99.",
  },
  {
    row: 2,
    reads: '[sub_resource] reads a declared ExtResource whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://gone1.tres" id="1"]

[sub_resource type="Resource" id="a"]
metadata/x = ExtResource("1")

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone1.tres', kind: 'section ExtResource', line: 6 }],
    stop: null,
  },
  {
    row: 3,
    reads: '[sub_resource] reads a Resource() literal whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = Resource("res://gone2.tres")

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone2.tres', kind: 'section Resource', line: 4 }],
    stop: null,
  },
  {
    row: 4,
    reads: '[sub_resource] reads a Resource() literal with two paths',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = Resource("res://a.tres", "res://b.tres")

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: 'res://row04.tscn:4 - Parse Error: Two non-uid paths in one Resource reference.',
  },
  {
    row: 5,
    reads: '[sub_resource] reads a Resource() literal with two uids',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = Resource("uid://a1", "uid://b2")

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: 'res://row05.tscn:4 - Parse Error: Two uid:// paths in one Resource reference.',
  },
  {
    row: 6,
    reads: '[sub_resource] reads an undeclared SubResource',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = SubResource("zz")

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: 'res://row06.tscn:4 - Parse Error: .',
  },
  {
    row: 7,
    reads: '[sub_resource] reads a SubResource declared after it',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = SubResource("b")

[sub_resource type="Resource" id="b"]

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: 'res://row07.tscn:4 - Parse Error: .',
  },
  {
    row: 8,
    reads: '[sub_resource] reads an undeclared ExtResource in an Array',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = [ExtResource("99")]

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: "res://row08.tscn:4 - Parse Error: Can't load cached ext-resource id: 99.",
  },
  {
    row: 9,
    reads: '[sub_resource] reads a missing Resource() literal in a Dictionary',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = {
"k": Resource("res://gone3.tres")
}

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone3.tres', kind: 'section Resource', line: 5 }],
    stop: null,
  },
  {
    row: 10,
    reads: '[sub_resource] reads a missing ExtResource in a typed Array',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://gone4.tres" id="1"]

[sub_resource type="Resource" id="a"]
metadata/x = Array[Resource]([ExtResource("1")])

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone4.tres', kind: 'section ExtResource', line: 6 }],
    stop: null,
  },
  {
    row: 11,
    reads: '[node] reads an undeclared ExtResource',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]
metadata/x = ExtResource("99")
`,
    failing: [],
    stop: 'Parse Error: Parse error. [Resource file res://row11.tscn:4]',
  },
  {
    row: 12,
    reads: '[node] reads a declared ExtResource whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://gone5.tres" id="1"]

[node name="Root" type="Node2D"]
metadata/x = ExtResource("1")
`,
    failing: [],
    stop: null,
  },
  {
    row: 13,
    reads: '[node] reads a Resource() literal whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]
metadata/x = Resource("res://gone6.tres")
`,
    failing: [{ path: 'res://gone6.tres', kind: 'node Resource', line: 4 }],
    stop: null,
  },
  {
    row: 14,
    reads: '[node] reads an undeclared SubResource',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]
metadata/x = SubResource("zz")
`,
    failing: [],
    stop: 'Parse Error: Invalid parameter. [Resource file res://row14.tscn:4]',
  },
  {
    row: 15,
    reads: '[node] script reads a declared ExtResource whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Script" path="res://gone7.gd" id="1"]

[node name="Root" type="Node2D"]
script = ExtResource("1")
`,
    failing: [],
    stop: null,
  },
  {
    row: 16,
    reads: 'a [node] after a [node] instances a missing file',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://gone8.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="X" parent="." instance=ExtResource("1")]
`,
    failing: [],
    stop: null,
  },
  {
    row: 17,
    reads: '[node] names a missing instance_placeholder',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="X" parent="." instance_placeholder="res://gone9.tscn"]
`,
    failing: [],
    stop: null,
  },
  {
    row: 18,
    reads: '[connection] binds an undeclared ExtResource',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="queue_free" binds=[ExtResource("99")]]
`,
    failing: [],
    stop: 'Parse Error: Parse error. [Resource file res://row18.tscn:5]',
  },
  {
    row: 19,
    reads: '[connection] binds a Resource() literal whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="queue_free" binds=[Resource("res://gone10.tres")]]
`,
    failing: [{ path: 'res://gone10.tres', kind: 'node Resource', line: 5 }],
    stop: null,
  },
  {
    row: 20,
    reads: '[editable] names a plain node',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="X" type="Node2D" parent="."]

[editable path="X"]
`,
    failing: [],
    stop: null,
  },
  {
    row: 21,
    reads: '[sub_resource] reads a file that loads, then an undeclared ExtResource',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://ok.tres" id="1"]

[sub_resource type="Resource" id="a"]
metadata/x = ExtResource("1")

[sub_resource type="Resource" id="b"]
metadata/x = ExtResource("99")

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://ok.tres', kind: 'section ExtResource', line: 6 }],
    stop: "res://row21.tscn:9 - Parse Error: Can't load cached ext-resource id: 99.",
  },
  {
    row: 22,
    reads: '[sub_resource] reads an undeclared SubResource, then a missing file',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://gone11.tres" id="1"]

[sub_resource type="Resource" id="a"]
metadata/x = SubResource("zz")

[sub_resource type="Resource" id="b"]
metadata/x = ExtResource("1")

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: 'res://row22.tscn:6 - Parse Error: .',
  },
  {
    row: 23,
    reads: '[resource] reads an undeclared ExtResource',
    file: 'tres',
    text: `[gd_resource type="Resource" format=3]

[resource]
metadata/x = ExtResource("99")
`,
    failing: [],
    stop: "res://row23.tres:4 - Parse Error: Can't load cached ext-resource id: 99.",
  },
  {
    row: 24,
    reads: '[resource] reads an undeclared SubResource',
    file: 'tres',
    text: `[gd_resource type="Resource" format=3]

[resource]
metadata/x = SubResource("zz")
`,
    failing: [],
    stop: 'res://row24.tres:4 - Parse Error: .',
  },
  {
    row: 25,
    reads: '[sub_resource] of a .tres reads a missing Resource() literal',
    file: 'tres',
    text: `[gd_resource type="Resource" format=3]

[sub_resource type="Resource" id="a"]
metadata/x = Resource("res://gone12.tres")

[resource]
`,
    failing: [{ path: 'res://gone12.tres', kind: 'section Resource', line: 4 }],
    stop: null,
  },
  {
    row: 26,
    reads: '[resource] reads a Resource() literal with two paths',
    file: 'tres',
    text: `[gd_resource type="Resource" format=3]

[resource]
metadata/x = Resource("res://a.tres", "res://b.tres")
`,
    failing: [],
    stop: 'res://row26.tres:4 - Parse Error: Two non-uid paths in one Resource reference.',
  },
  {
    row: 27,
    reads: 'the first [node] instances a missing file',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://gone13.tscn" id="1"]

[node name="Root" instance=ExtResource("1")]
`,
    failing: [{ path: 'res://gone13.tscn', kind: 'section ExtResource', line: 5 }],
    stop: null,
  },
  {
    row: 28,
    reads: 'the first [node] instances an undeclared ExtResource',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" instance=ExtResource("99")]
`,
    failing: [],
    stop: 'res://row28.tscn:3 - Parse Error: Unexpected end of file.',
  },
  {
    row: 29,
    reads: 'a [node] after a [connection] instances a missing file',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://gone14.tscn" id="1"]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="queue_free"]

[node name="X" parent="." instance=ExtResource("1")]
`,
    failing: [{ path: 'res://gone14.tscn', kind: 'section ExtResource', line: 9 }],
    stop: null,
  },
  {
    row: 30,
    reads: '[connection] binds a declared ExtResource whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://gone15.tres" id="1"]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="queue_free" binds=[ExtResource("1")]]
`,
    failing: [{ path: 'res://gone15.tres', kind: 'section ExtResource', line: 7 }],
    stop: null,
  },
  {
    row: 31,
    reads: 'a [node] after a [node] instances a file that loads',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://ok_scene.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="X" parent="." instance=ExtResource("1")]
`,
    failing: [],
    stop: null,
  },
  {
    row: 32,
    reads: '[node] reads a missing ExtResource, then another [node] follows',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://gone16.tres" id="1"]

[node name="Root" type="Node2D"]
metadata/x = ExtResource("1")

[node name="Y" type="Node2D" parent="."]
`,
    failing: [],
    stop: null,
  },
  {
    row: 33,
    reads: 'a [node] reads a missing literal before a [node] after an [editable] instances a missing file',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://gone17.tscn" id="2"]

[node name="Root" type="Sprite2D"]
texture = Resource("res://gone18.png")

[node name="X" type="Node2D" parent="."]

[editable path="X"]

[node name="After" parent="." instance=ExtResource("2")]
`,
    failing: [
      { path: 'res://gone18.png', kind: 'node Resource', line: 6 },
      { path: 'res://gone17.tscn', kind: 'section ExtResource', line: 12 },
    ],
    stop: null,
  },
  {
    row: 34,
    reads:
      'a [node] reads an undeclared ExtResource before a [node] after an [editable] instances a missing file',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://gone19.tscn" id="2"]

[node name="Root" type="Node2D"]
metadata/x = ExtResource("99")

[node name="X" type="Node2D" parent="."]

[editable path="X"]

[node name="After" parent="." instance=ExtResource("2")]
`,
    failing: [],
    stop: 'Parse Error: Parse error. [Resource file res://row34.tscn:6]',
  },
  {
    row: 35,
    reads: 'a [node] reads a missing literal before a later [node] seated earlier in the tree',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="A" type="Node2D" parent="."]

[node name="B" type="Sprite2D" parent="."]
texture = Resource("res://gone20.png")

[node name="C" type="Sprite2D" parent="A"]
texture = Resource("res://gone21.png")
`,
    failing: [
      { path: 'res://gone20.png', kind: 'node Resource', line: 8 },
      { path: 'res://gone21.png', kind: 'node Resource', line: 11 },
    ],
    stop: null,
  },
  {
    row: 36,
    reads: 'a [connection] binds a missing literal before a later [node] reads one',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="queue_free" binds=[Resource("res://gone22.tres")]]

[node name="X" type="Sprite2D" parent="."]
texture = Resource("res://gone23.png")
`,
    failing: [
      { path: 'res://gone22.tres', kind: 'node Resource', line: 5 },
      { path: 'res://gone23.png', kind: 'node Resource', line: 8 },
    ],
    stop: null,
  },
  {
    row: 37,
    reads: 'a [node] reads a missing literal between two [node] headings that instance one text',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://gone25.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="A" parent="." instance=ExtResource("1")]

[node name="X" type="Sprite2D" parent="."]
texture = Resource("res://gone24.png")

[connection signal="ready" from="." to="." method="queue_free"]

[node name="B" parent="." instance=ExtResource("1")]
`,
    failing: [
      { path: 'res://gone24.png', kind: 'node Resource', line: 10 },
      { path: 'res://gone25.tscn', kind: 'section ExtResource', line: 14 },
    ],
    stop: null,
  },
  {
    row: 38,
    reads: 'a [sub_resource] array value reads a missing file on its first line of three',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://gone.png" id="1"]

[sub_resource type="Resource" id="a"]
metadata/x = [ExtResource("1"),
1,
2]

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone.png', kind: 'section ExtResource', line: 6 }],
    stop: null,
  },
  {
    row: 39,
    reads: 'a [sub_resource] array value reads a missing literal on its second line',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = [1,
Resource("res://gone.tres"),
2]

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone.tres', kind: 'section Resource', line: 5 }],
    stop: null,
  },
  {
    row: 40,
    reads: 'a [node] array value reads a missing literal on its second line',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]
metadata/x = [1,
Resource("res://gone.tres"),
2,
3]
`,
    failing: [{ path: 'res://gone.tres', kind: 'node Resource', line: 5 }],
    stop: null,
  },
  {
    row: 41,
    reads: 'a [connection] binds= reads a missing Resource() literal',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="free" binds=[Resource("res://gone.tres")]]
`,
    failing: [{ path: 'res://gone.tres', kind: 'node Resource', line: 5 }],
    stop: null,
  },
  {
    row: 42,
    reads: 'a [sub_resource] value over four lines reads a missing file on its second',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://gone.png" id="1"]

[sub_resource type="Resource" id="a"]
metadata/x = 1
metadata/y = [
ExtResource("1"),
3
]
metadata/z = 2

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone.png', kind: 'section ExtResource', line: 8 }],
    stop: null,
  },
  {
    row: 43,
    reads: 'an ExtResource( call puts its id on the next line',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://gone.png" id="1"]

[sub_resource type="Resource" id="a"]
metadata/x = ExtResource(
"1"
)

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone.png', kind: 'section ExtResource', line: 7 }],
    stop: null,
  },
  {
    row: 44,
    reads: 'a [node] Resource( literal puts its path on the next line',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]
metadata/x = Resource(
"res://gone.tres"
)
`,
    failing: [{ path: 'res://gone.tres', kind: 'node Resource', line: 6 }],
    stop: null,
  },
  {
    row: 45,
    reads: 'a [node] value reads a Resource() literal with two paths',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]
metadata/x = Resource("res://a.tres", "res://b.tres")
`,
    failing: [],
    stop: 'Parse Error: Parse error. [Resource file res://row45.tscn:4]',
  },
  {
    row: 46,
    reads: 'a [connection] binds= reads a Resource() literal with two uids',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="free" binds=[Resource("uid://a1", "uid://b2")]]
`,
    failing: [],
    stop: 'Parse Error: Parse error. [Resource file res://row46.tscn:5]',
  },
  {
    row: 47,
    reads: 'a [connection] binds= reads an undeclared SubResource id',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="free" binds=[SubResource("zz")]]
`,
    failing: [],
    stop: 'Parse Error: Invalid parameter. [Resource file res://row47.tscn:5]',
  },
  {
    row: 48,
    reads: 'the instance= of a [node] after a [connection] names an undeclared ExtResource id',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="free"]

[node name="A" parent="." instance=ExtResource("99")]

[node name="B" type="Node2D" parent="."]
`,
    failing: [],
    stop: "res://row48.tscn:7 - Parse Error: Can't load cached ext-resource id: 99.",
  },
  {
    row: 49,
    reads: 'the instance= of the first heading names an undeclared ExtResource id, before a node',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" instance=ExtResource("99")]

[node name="A" type="Node2D" parent="."]
`,
    failing: [],
    stop: 'res://row49.tscn:3 - Parse Error: Unexpected end of file.',
  },
  {
    row: 50,
    reads: 'the instance= of a [node] after a node names an undeclared ExtResource id',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="A" parent="." instance=ExtResource("99")]

[node name="B" type="Node2D" parent="."]
`,
    failing: [],
    stop: 'Parse Error: Parse error. [Resource file res://row50.tscn:5]',
  },
  {
    row: 51,
    reads: 'the instance= of a [node] after a node names an undeclared SubResource id',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="A" parent="." instance=SubResource("zz")]
`,
    failing: [],
    stop: 'Parse Error: Invalid parameter. [Resource file res://row51.tscn:5]',
  },
  {
    row: 52,
    reads: 'the instance= of the first heading names an undeclared SubResource id',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" instance=SubResource("zz")]

[node name="A" type="Node2D" parent="."]
`,
    failing: [],
    stop: 'res://row52.tscn:3 - Parse Error: Unexpected end of file.',
  },
  {
    row: 53,
    reads: 'the instance= of a [node] after a node is a Resource() literal with two paths',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="A" parent="." instance=Resource("res://a.tres", "res://b.tres")]
`,
    failing: [],
    stop: 'Parse Error: Parse error. [Resource file res://row53.tscn:5]',
  },
  {
    row: 54,
    reads: 'the instance= of a [node] after a [sub_resource] names an undeclared ExtResource id',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = 1

[node name="Root" instance=ExtResource("99")]
`,
    failing: [],
    stop: "res://row54.tscn:6 - Parse Error: Can't load cached ext-resource id: 99.",
  },
  {
    row: 55,
    reads: 'the instance= of a [node] after a [connection] names an undeclared SubResource id',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="free"]

[node name="A" parent="." instance=SubResource("zz")]
`,
    failing: [],
    stop: 'res://row55.tscn:7 - Parse Error: .',
  },
  {
    row: 56,
    reads: 'the instance= of a [node] after an [ext_resource] is a Resource() literal with two paths',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://ok.tres" id="1"]

[node name="Root" instance=Resource("res://a.tres", "res://b.tres")]
`,
    failing: [],
    stop: 'res://row56.tscn:5 - Parse Error: Two non-uid paths in one Resource reference.',
  },
  {
    row: 57,
    reads: 'the instance= of a [node] after a [connection] is a Resource() literal with two paths',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="free"]

[node name="A" parent="." instance=Resource("res://a.tres", "res://b.tres")]
`,
    failing: [],
    stop: 'res://row57.tscn:7 - Parse Error: Two non-uid paths in one Resource reference.',
  },
  {
    row: 58,
    reads: '[sub_resource] reads an ExtResource whose heading comes after it',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = ExtResource("1")

[ext_resource type="Resource" path="res://ok58.tres" id="1"]

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: "res://row58.tscn:4 - Parse Error: Can't load cached ext-resource id: 1.",
  },
  {
    row: 59,
    reads: 'an [ext_resource] heading after a [sub_resource] that nothing reads',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]

[ext_resource type="Resource" path="res://ok58.tres" id="1"]

[node name="Root" type="Node2D"]
metadata/x = ExtResource("1")
`,
    failing: [],
    stop: "res://row59.tscn:5 - Parse Error: Unknown tag 'ext_resource' in file.",
  },
  {
    row: 60,
    reads: '[node] reads an ExtResource whose heading comes after it',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]
metadata/x = ExtResource("1")

[ext_resource type="Resource" path="res://ok58.tres" id="1"]
`,
    failing: [],
    stop: 'Parse Error: Parse error. [Resource file res://row60.tscn:4]',
  },
  {
    row: 61,
    reads: 'an [ext_resource] heading after a [node]',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[ext_resource type="Resource" path="res://ok58.tres" id="1"]
`,
    failing: [],
    stop: "res://row61.tscn:5 - Parse Error: Unknown tag 'ext_resource' in file.",
  },
  {
    row: 62,
    reads: 'a [sub_resource] heading after a [node]',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[sub_resource type="Resource" id="a"]
`,
    failing: [],
    stop: "res://row62.tscn:5 - Parse Error: Unknown tag 'sub_resource' in file.",
  },
  {
    row: 63,
    reads: '.tres: an [ext_resource] heading after a [sub_resource]',
    file: 'tres',
    text: `[gd_resource type="Resource" format=3]

[sub_resource type="Resource" id="a"]

[ext_resource type="Resource" path="res://ok58.tres" id="1"]

[resource]
`,
    failing: [],
    stop: "res://row63.tres:5 - Parse Error: Unknown tag 'ext_resource' in file.",
  },
  {
    row: 64,
    reads: '.tres: a [sub_resource] heading after the [resource]',
    file: 'tres',
    text: `[gd_resource type="Resource" format=3]

[resource]

[sub_resource type="Resource" id="a"]
`,
    failing: [],
    stop: 'res://row64.tres:5 - Parse Error: Extra tag found when parsing main resource file.',
  },
  {
    row: 65,
    reads: 'a [sub_resource] heading after a [connection]',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="x"]

[sub_resource type="Resource" id="a"]
`,
    failing: [],
    stop: "res://row65.tscn:7 - Parse Error: Unknown tag 'sub_resource' in file.",
  },
  {
    row: 66,
    reads: 'an [ext_resource], a [sub_resource] and a [node] in order',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="Resource" path="res://ok58.tres" id="1"]

[sub_resource type="Resource" id="a"]

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: null,
  },
  {
    row: 67,
    reads: 'a [resource] heading in a scene',
    file: 'tscn',
    text: `[gd_scene format=3]

[resource]

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: "res://row67.tscn:3 - Parse Error: Unexpected 'resource' tag in a scene file.",
  },
  {
    row: 68,
    reads: '.tres: a [node] heading',
    file: 'tres',
    text: `[gd_resource type="Resource" format=3]

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: "res://row68.tres:3 - Parse Error: Unexpected 'node' tag in a resource file.",
  },
  {
    row: 69,
    reads: '[sub_resource] reads a missing literal, then a late [ext_resource] heading',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = Resource("res://gone69.tres")

[ext_resource type="Resource" path="res://ok58.tres" id="1"]

[node name="Root" type="Node2D"]
`,
    failing: [{ path: 'res://gone69.tres', kind: 'section Resource', line: 4 }],
    stop: "res://row69.tscn:6 - Parse Error: Unknown tag 'ext_resource' in file.",
  },
  {
    row: 70,
    reads: 'a late [ext_resource] heading, then a [sub_resource] that reads a missing literal',
    file: 'tscn',
    text: `[gd_scene format=3]

[sub_resource type="Resource" id="a"]

[ext_resource type="Resource" path="res://ok58.tres" id="1"]

[sub_resource type="Resource" id="b"]
metadata/x = Resource("res://gone70.tres")

[node name="Root" type="Node2D"]
`,
    failing: [],
    stop: "res://row70.tscn:5 - Parse Error: Unknown tag 'ext_resource' in file.",
  },
];

/** The path Godot loaded the row under, which its stop line names. */
function rowPath({ row, file }: GodotRow): string {
  return `res://row${String(row).padStart(2, '0')}.${file}`;
}

function failingReadsOf(row: GodotRow) {
  const path = rowPath(row);
  return row.file === 'tscn'
    ? sceneFailingReads(path, new TscnParser().parse(row.text))
    : resourceFailingReads(path, parseTresFile(row.text));
}

describe('the reads that fail a file, as Godot 4.6.3 loads it', () => {
  it.each(ROWS)('row $row: $reads', (row) => {
    const { failing, parseStop } = failingReadsOf(row);

    expect({
      failing: failing.map(({ path, kind, line }) => ({ path, kind, line })),
      stop: sceneFailureOf([], { scene: rowPath(row), reads: [], parseStop })?.line ?? null,
    }).toEqual({ failing: row.failing, stop: row.stop });
  });
});
