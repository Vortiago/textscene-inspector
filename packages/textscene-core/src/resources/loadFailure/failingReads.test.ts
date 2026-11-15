import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { TscnParser } from '../../parser/TscnParser';
import { resourceFailingReads, sceneFailingReads } from './failingReads';

const scene = (text: string) => new TscnParser().parse(text);

describe('sceneFailingReads', () => {
  it('lists the file a [sub_resource] property reads', () => {
    const reads = sceneFailingReads(
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")
[node name="Root" type="Node2D"]
`)
    );

    expect(reads).toEqual(['res://gone.png']);
  });

  it('leaves out the file only a [node] property reads', () => {
    const reads = sceneFailingReads(
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[node name="Root" type="Sprite2D"]
texture = ExtResource("1")
`)
    );

    expect(reads).toEqual([]);
  });

  it('leaves out a declared file nothing reads', () => {
    const reads = sceneFailingReads(
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[node name="Root" type="Node2D"]
`)
    );

    expect(reads).toEqual([]);
  });

  it('lists the path of a Resource() literal in a [node] property', () => {
    const reads = sceneFailingReads(
      scene(`[gd_scene format=3]
[node name="Root" type="Sprite2D"]
texture = Resource("res://gone.png")
`)
    );

    expect(reads).toEqual(['res://gone.png']);
  });
});

describe('resourceFailingReads', () => {
  it('lists the file the [resource] section reads', () => {
    const reads = resourceFailingReads(
      parseTresFile(`[gd_resource type="AtlasTexture" format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[resource]
atlas = ExtResource("1")
`)
    );

    expect(reads).toEqual(['res://gone.png']);
  });

  it('lists the file a [sub_resource] of a .tres reads inside an array', () => {
    const reads = resourceFailingReads(
      parseTresFile(`[gd_resource type="Resource" format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[sub_resource type="Resource" id="s"]
textures = [ExtResource("1")]
[resource]
`)
    );

    expect(reads).toEqual(['res://gone.png']);
  });
});
