import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';
import type { CallResult } from './nodeMethods';

const LIBRARIES = `[gd_scene format=3]

[sub_resource type="AnimationLibrary" id="lib_z"]

[sub_resource type="AnimationLibrary" id="lib_a"]

[sub_resource type="AnimationLibrary" id="lib_b"]

[node name="Main" type="Node"]

[node name="A" type="AnimationPlayer" parent="."]
libraries = {
&"zeta": SubResource("lib_z"),
&"": SubResource("lib_a"),
&"bad/name": SubResource("lib_b"),
&"twice": SubResource("lib_a")
}
libraries/beta = SubResource("lib_b")

[node name="B" type="AnimationPlayer" parent="."]
`;

function openLibraries(): Scene {
  return openScene({
    source: LIBRARIES,
    rootScenePath: 'res://anim.tscn',
    provider: { loadResource: async () => null },
  });
}

function textOf(value: CallResult): string | null {
  return value !== null && typeof value === 'object' && 'text' in value ? value.text : JSON.stringify(value);
}

// Each answer is what Godot 4.6.3 gives for the same scene (measured).
describe('get_animation_library_list', () => {
  it('lists the libraries add_animation_library keeps, sorted by name, without a refused one', async () => {
    const list = await openLibraries().getNode('A').call('get_animation_library_list');

    expect(textOf(list)).toBe('Array[StringName]([&"", &"beta", &"zeta"])');
  });

  it('lists none for a player whose file sets no library', async () => {
    const list = await openLibraries().getNode('B').call('get_animation_library_list');

    expect(textOf(list)).toBe('Array[StringName]([])');
  });
});

describe('get_animation_library_list of a library added twice', () => {
  const TWICE = `[gd_scene format=3]

[sub_resource type="AnimationLibrary" id="l1"]

[sub_resource type="AnimationLibrary" id="l2"]

[sub_resource type="AnimationLibrary" id="l3"]

[node name="A" type="AnimationPlayer"]
libraries = {
&"a": SubResource("l1"),
&"c": SubResource("l2"),
&"z": SubResource("l3"),
&"b": SubResource("l3"),
&"y": SubResource("l2")
}
`;

  it('refuses a library only where it lies before the insert position, as Godot does', async () => {
    const scene = openScene({
      source: TWICE,
      rootScenePath: 'res://twice.tscn',
      provider: { loadResource: async () => null },
    });

    expect(textOf(await scene.getNode('.').call('get_animation_library_list'))).toBe(
      'Array[StringName]([&"a", &"b", &"c", &"z"])'
    );
  });
});

describe('get_animation_library', () => {
  it('answers the resource each listed name holds', async () => {
    const player = openLibraries().getNode('A');
    const paths = await Promise.all(
      ['', 'beta', 'zeta'].map((name) => player.call('get_animation_library', name))
    );

    expect(paths.map(textOf)).toEqual([
      'Resource("res://anim.tscn::lib_a")',
      'Resource("res://anim.tscn::lib_b")',
      'Resource("res://anim.tscn::lib_z")',
    ]);
  });

  it('answers null for a name it does not hold', async () => {
    expect(await openLibraries().getNode('A').call('get_animation_library', 'nope')).toBeNull();
  });
});

describe('get_animation_library_list of an instanced player', () => {
  const PLAYER = `[gd_scene format=3]

[sub_resource type="AnimationLibrary" id="walk"]

[node name="Player" type="AnimationPlayer"]
libraries = {
&"": SubResource("walk")
}
`;
  const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node"]

[node name="Hero" parent="." instance=ExtResource("player")]
`;

  it('lists the library a sub-resource of the instanced scene holds', async () => {
    const scene = openScene({
      source: MAIN,
      rootScenePath: 'res://main.tscn',
      provider: { loadResource: async (path) => (path === 'res://player.tscn' ? PLAYER : null) },
    });
    await vi.waitFor(() => expect(scene.getNodeOrNull('Hero')?.type).toBe('AnimationPlayer'));

    const hero = scene.getNode('Hero');
    expect(textOf(await hero.call('get_animation_library_list'))).toBe('Array[StringName]([&""])');
    expect(textOf(await hero.call('get_animation_library', ''))).toBe('Resource("res://player.tscn::walk")');
  });
});
