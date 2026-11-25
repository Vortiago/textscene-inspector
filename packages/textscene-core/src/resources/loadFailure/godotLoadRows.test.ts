import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { TscnParser } from '../../parser/TscnParser';
import { resourceFileReads, sceneFileReads, type FailingReadKind } from './fileReads';

interface GodotRow {
  row: number;
  reads: string;
  file: 'tscn' | 'tres';
  text: string;
  /** The reads whose failure fails the file, up to where the parse fails. */
  failing: { path: string; kind: FailingReadKind }[];
  failsToParse: boolean;
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
    failsToParse: true,
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
    failing: [{ path: 'res://gone1.tres', kind: 'section ExtResource' }],
    failsToParse: false,
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
    failing: [{ path: 'res://gone2.tres', kind: 'section Resource' }],
    failsToParse: false,
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
    failsToParse: true,
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
    failsToParse: true,
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
    failsToParse: true,
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
    failsToParse: true,
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
    failsToParse: true,
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
    failing: [{ path: 'res://gone3.tres', kind: 'section Resource' }],
    failsToParse: false,
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
    failing: [{ path: 'res://gone4.tres', kind: 'section ExtResource' }],
    failsToParse: false,
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
    failsToParse: true,
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
    failsToParse: false,
  },
  {
    row: 13,
    reads: '[node] reads a Resource() literal whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]
metadata/x = Resource("res://gone6.tres")
`,
    failing: [{ path: 'res://gone6.tres', kind: 'node Resource' }],
    failsToParse: false,
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
    failsToParse: true,
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
    failsToParse: false,
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
    failsToParse: false,
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
    failsToParse: false,
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
    failsToParse: true,
  },
  {
    row: 19,
    reads: '[connection] binds a Resource() literal whose file is missing',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="ready" from="." to="." method="queue_free" binds=[Resource("res://gone10.tres")]]
`,
    failing: [{ path: 'res://gone10.tres', kind: 'node Resource' }],
    failsToParse: false,
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
    failsToParse: false,
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
    failing: [{ path: 'res://ok.tres', kind: 'section ExtResource' }],
    failsToParse: true,
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
    failsToParse: true,
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
    failsToParse: true,
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
    failsToParse: true,
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
    failing: [{ path: 'res://gone12.tres', kind: 'section Resource' }],
    failsToParse: false,
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
    failsToParse: true,
  },
  {
    row: 27,
    reads: 'the first [node] instances a missing file',
    file: 'tscn',
    text: `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://gone13.tscn" id="1"]

[node name="Root" instance=ExtResource("1")]
`,
    failing: [{ path: 'res://gone13.tscn', kind: 'section ExtResource' }],
    failsToParse: false,
  },
  {
    row: 28,
    reads: 'the first [node] instances an undeclared ExtResource',
    file: 'tscn',
    text: `[gd_scene format=3]

[node name="Root" instance=ExtResource("99")]
`,
    failing: [],
    failsToParse: true,
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
    failing: [{ path: 'res://gone14.tscn', kind: 'section ExtResource' }],
    failsToParse: false,
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
    failing: [{ path: 'res://gone15.tres', kind: 'section ExtResource' }],
    failsToParse: false,
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
    failsToParse: false,
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
    failsToParse: false,
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
      { path: 'res://gone18.png', kind: 'node Resource' },
      { path: 'res://gone17.tscn', kind: 'section ExtResource' },
    ],
    failsToParse: false,
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
    failsToParse: true,
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
      { path: 'res://gone20.png', kind: 'node Resource' },
      { path: 'res://gone21.png', kind: 'node Resource' },
    ],
    failsToParse: false,
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
      { path: 'res://gone22.tres', kind: 'node Resource' },
      { path: 'res://gone23.png', kind: 'node Resource' },
    ],
    failsToParse: false,
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
      { path: 'res://gone24.png', kind: 'node Resource' },
      { path: 'res://gone25.tscn', kind: 'section ExtResource' },
    ],
    failsToParse: false,
  },
];

function fileReadsOf({ file, text }: GodotRow) {
  const path = `res://row.${file}`;
  return file === 'tscn'
    ? sceneFileReads(path, new TscnParser().parse(text))
    : resourceFileReads(path, parseTresFile(text));
}

describe('the reads that fail a file, as Godot 4.6.3 loads it', () => {
  it.each(ROWS)('row $row: $reads', (row) => {
    const { failing, failsToParse } = fileReadsOf(row);

    expect({ failing: failing.map(({ path, kind }) => ({ path, kind })), failsToParse }).toEqual({
      failing: row.failing,
      failsToParse: row.failsToParse,
    });
  });
});
