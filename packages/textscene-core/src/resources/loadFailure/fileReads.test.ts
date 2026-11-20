import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { TscnParser } from '../../parser/TscnParser';
import { resourceFailingReads, sceneFailingReads } from './fileReads';

const scene = (text: string) => new TscnParser().parse(text);
const MAIN = 'res://levels/main.tscn';
const MAIN_TRES = 'res://levels/main.tres';

describe('sceneFailingReads', () => {
  it('lists the file a [sub_resource] property reads', () => {
    const reads = sceneFailingReads(
      MAIN,
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
      MAIN,
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
      MAIN,
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[node name="Root" type="Node2D"]
`)
    );

    expect(reads).toEqual([]);
  });

  it('lists the path of a Resource() literal in a [node] property', () => {
    const reads = sceneFailingReads(
      MAIN,
      scene(`[gd_scene format=3]
[node name="Root" type="Sprite2D"]
texture = Resource("res://gone.png")
`)
    );

    expect(reads).toEqual(['res://gone.png']);
  });

  it('leaves out a Resource() literal written inside a string', () => {
    const reads = sceneFailingReads(
      MAIN,
      scene(`[gd_scene format=3]
[node name="Root" type="Label"]
text = "Resource(\\"res://gone.png\\")"
`)
    );

    expect(reads).toEqual([]);
  });
});

describe('a relative ext_resource path', () => {
  it('resolves against the folder of the file that reads it', () => {
    const reads = sceneFailingReads(
      MAIN,
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="../art/rock.png" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")
[node name="Root" type="Node2D"]
`)
    );

    expect(reads).toEqual(['res://art/rock.png']);
  });
});

describe('resourceFailingReads', () => {
  it('lists the file the [resource] section reads', () => {
    const reads = resourceFailingReads(
      MAIN_TRES,
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
      MAIN_TRES,
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
