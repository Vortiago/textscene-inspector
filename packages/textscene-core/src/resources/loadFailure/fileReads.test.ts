import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { TscnParser } from '../../parser/TscnParser';
import { resourceFileReads, sceneFileReads, type FailingFileRead } from './fileReads';
import type { ParsedResource } from '../../parser/parsedResource';

const scene = (text: string) => new TscnParser().parse(text);
const MAIN = 'res://levels/main.tscn';
const MAIN_TRES = 'res://levels/main.tres';

const pathsOf = (reads: readonly FailingFileRead[]) => reads.map((read) => read.path);
const sectionsReading = (read: string) => `[gd_scene format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="2"]
[sub_resource type="AtlasTexture" id="a"]
atlas = ${read}
[sub_resource type="AtlasTexture" id="b"]
atlas = ExtResource("2")
[node name="Root" type="Node2D"]
`;
const sceneFailing = (file: string, parsed: ReturnType<typeof scene>) => sceneFileReads(file, parsed).failing;
const sceneFilesRead = (file: string, parsed: ReturnType<typeof scene>) => sceneFileReads(file, parsed).reads;
const resourceFailing = (file: string, parsed: ParsedResource) => resourceFileReads(file, parsed).failing;
const resourceFilesRead = (file: string, parsed: ParsedResource) => resourceFileReads(file, parsed).reads;

describe('the failing reads of a scene', () => {
  it('lists the file a [sub_resource] property reads', () => {
    const reads = pathsOf(
      sceneFailing(
        MAIN,
        scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")
[node name="Root" type="Node2D"]
`)
      )
    );

    expect(reads).toEqual(['res://gone.png']);
  });

  it('leaves out the file only a [node] property reads', () => {
    const reads = pathsOf(
      sceneFailing(
        MAIN,
        scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[node name="Root" type="Sprite2D"]
texture = ExtResource("1")
`)
      )
    );

    expect(reads).toEqual([]);
  });

  it('leaves out a declared file nothing reads', () => {
    const reads = pathsOf(
      sceneFailing(
        MAIN,
        scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[node name="Root" type="Node2D"]
`)
      )
    );

    expect(reads).toEqual([]);
  });

  it('lists the path of a Resource() literal in a [node] property', () => {
    const reads = pathsOf(
      sceneFailing(
        MAIN,
        scene(`[gd_scene format=3]
[node name="Root" type="Sprite2D"]
texture = Resource("res://gone.png")
`)
      )
    );

    expect(reads).toEqual(['res://gone.png']);
  });

  it('leaves out a Resource() literal written inside a string', () => {
    const reads = pathsOf(
      sceneFailing(
        MAIN,
        scene(`[gd_scene format=3]
[node name="Root" type="Label"]
text = "Resource(\\"res://gone.png\\")"
`)
      )
    );

    expect(reads).toEqual([]);
  });
});

describe('a relative ext_resource path', () => {
  it('resolves against the folder of the file that reads it', () => {
    const reads = pathsOf(
      sceneFailing(
        MAIN,
        scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="../art/rock.png" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")
[node name="Root" type="Node2D"]
`)
      )
    );

    expect(reads).toEqual(['res://art/rock.png']);
  });
});

describe('the failing reads of a resource', () => {
  it('lists the file the [resource] section reads', () => {
    const reads = pathsOf(
      resourceFailing(
        MAIN_TRES,
        parseTresFile(`[gd_resource type="AtlasTexture" format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[resource]
atlas = ExtResource("1")
`)
      )
    );

    expect(reads).toEqual(['res://gone.png']);
  });

  it('lists the file a [sub_resource] of a .tres reads inside an array', () => {
    const reads = pathsOf(
      resourceFailing(
        MAIN_TRES,
        parseTresFile(`[gd_resource type="Resource" format=3]
[ext_resource type="Texture2D" path="res://gone.png" id="1"]
[sub_resource type="Resource" id="s"]
textures = [ExtResource("1")]
[resource]
`)
      )
    );

    expect(reads).toEqual(['res://gone.png']);
  });
});

describe('the files a scene reads', () => {
  it('lists each file a value reads, a [node] value and an instance included, with its heading type', () => {
    const reads = sceneFilesRead(
      MAIN,
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://icon.png" id="1"]
[ext_resource type="PackedScene" path="res://enemy.tscn" id="2"]
[node name="Root" type="Sprite2D"]
texture = ExtResource("1")
[node name="Enemy" parent="." instance=ExtResource("2")]
`)
    );

    expect(reads).toEqual([
      { path: 'res://icon.png', type: 'Texture2D' },
      { path: 'res://enemy.tscn', type: 'PackedScene' },
    ]);
  });

  it('gives a Resource() literal no type', () => {
    const reads = sceneFilesRead(
      MAIN,
      scene(`[gd_scene format=3]
[node name="Root" type="Sprite2D"]
texture = Resource("res://icon.png")
`)
    );

    expect(reads).toEqual([{ path: 'res://icon.png', type: null }]);
  });

  it('leaves out a declared file nothing reads, and a path outside res://', () => {
    const reads = sceneFilesRead(
      MAIN,
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://unused.png" id="1"]
[ext_resource type="Texture2D" path="user://save.png" id="2"]
[node name="Root" type="Sprite2D"]
texture = ExtResource("2")
`)
    );

    expect(reads).toEqual([]);
  });
});

describe('the files a resource reads', () => {
  it('lists the files the [sub_resource] and [resource] sections of a .tres read, in file order', () => {
    const reads = resourceFilesRead(
      MAIN_TRES,
      parseTresFile(`[gd_resource type="StandardMaterial3D" format=3]
[ext_resource type="Texture2D" path="albedo.png" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = Resource("res://atlas.png")
[resource]
albedo_texture = ExtResource("1")
`)
    );

    expect(reads).toEqual([
      { path: 'res://atlas.png', type: null },
      { path: 'res://levels/albedo.png', type: 'Texture2D' },
    ]);
  });

  it('lists nothing for a .tres that reads no file', () => {
    const reads = resourceFilesRead(
      MAIN_TRES,
      parseTresFile('[gd_resource type="Curve" format=3]\n[resource]\n')
    );

    expect(reads).toEqual([]);
  });
});

describe('the kind of each failing read of a scene', () => {
  it('stops at an undeclared ExtResource id in a section, as the parse fails there', () => {
    const reads = sceneFailing(MAIN, scene(sectionsReading('ExtResource("99")')));

    expect(reads).toEqual([]);
  });

  it('says the file fails to parse at an undeclared id, and not where every id is declared', () => {
    expect(sceneFileReads(MAIN, scene(sectionsReading('ExtResource("99")'))).failsToParse).toBe(true);
    expect(sceneFileReads(MAIN, scene(sectionsReading('ExtResource("2")'))).failsToParse).toBe(false);
  });

  it('stops at an undeclared ExtResource id in a [node] section, as the parse fails there too', () => {
    const parsed = scene(`[gd_scene format=3]
[node name="Root" type="Sprite2D"]
texture = ExtResource("99")
[node name="Child" parent="." type="Sprite2D"]
texture = Resource("res://gone.png")
`);

    expect(sceneFileReads(MAIN, parsed)).toMatchObject({ failing: [], failsToParse: true });
  });

  it('stops at an undeclared ExtResource id in an instance field, as the parse fails there too', () => {
    const parsed = scene(`[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="X" parent="." instance=ExtResource("99")]
[node name="Y" parent="." type="Sprite2D"]
texture = Resource("res://gone.png")
`);

    expect(sceneFileReads(MAIN, parsed)).toMatchObject({ failing: [], failsToParse: true });
  });

  it('stops at a Resource() literal with two paths, which Godot does not parse', () => {
    const parsed = scene(sectionsReading('Resource("res://a.png", "res://b.png")'));

    expect(sceneFileReads(MAIN, parsed)).toMatchObject({ failing: [], failsToParse: true });
  });

  it('reads past a literal that may load: a uid alone, or a path off res://', () => {
    for (const read of ['Resource("uid://b9")', 'Resource("user://x.tres")']) {
      const reads = sceneFailing(MAIN, scene(sectionsReading(read)));

      expect(pathsOf(reads), read).toEqual(['res://gone.png']);
    }
  });

  it('keeps the type of an ext_resource heading over a literal of the same file read first', () => {
    const reads = sceneFilesRead(
      MAIN,
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://a.png" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = Resource("res://a.png")
[sub_resource type="AtlasTexture" id="b"]
atlas = ExtResource("1")
[node name="Root" type="Node2D"]
`)
    );

    expect(reads).toEqual([{ path: 'res://a.png', type: 'Texture2D' }]);
  });

  it('gives the kind of each failing read, in file order', () => {
    const reads = sceneFailing(
      MAIN,
      scene(`[gd_scene format=3]
[ext_resource type="Texture2D" path="res://ext.png" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = Resource("uid://b1", "res://literal.png")
[sub_resource type="AtlasTexture" id="b"]
atlas = ExtResource("1")
[node name="Root" type="Sprite2D"]
texture = Resource("res://node.png")
`)
    );

    expect(reads).toEqual([
      { path: 'res://literal.png', kind: 'section Resource', uid: 'uid://b1' },
      { path: 'res://ext.png', kind: 'section ExtResource', uid: '' },
      { path: 'res://node.png', kind: 'node Resource', uid: '' },
    ]);
  });

  it('gives no read for a scene that reads no file', () => {
    const reads = sceneFailing(MAIN, scene(`[gd_scene format=3]\n[node name="Root" type="Node2D"]\n`));

    expect(reads).toEqual([]);
  });
});
