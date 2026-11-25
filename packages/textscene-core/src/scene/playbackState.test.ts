import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';
import type { SceneValue } from './variant';

const PLAYBACK = `[gd_scene format=3]

[sub_resource type="Animation" id="a"]
length = 1.0

[sub_resource type="AnimationLibrary" id="lib"]
_data = {
&"walk": SubResource("a")
}

[sub_resource type="AudioStreamGenerator" id="gen"]

[node name="Main" type="Node"]

[node name="Auto" type="AnimationPlayer" parent="."]
libraries = {
&"": SubResource("lib")
}
autoplay = "walk"

[node name="Named" type="AnimationPlayer" parent="."]
libraries = {
&"moves": SubResource("lib")
}
autoplay = "moves/walk"

[node name="Still" type="AnimationPlayer" parent="."]
libraries = {
&"": SubResource("lib")
}

[node name="Missing" type="AnimationPlayer" parent="."]
autoplay = "missing"

[node name="Music" type="AudioStreamPlayer" parent="."]
stream = SubResource("gen")
autoplay = true

[node name="NoStream" type="AudioStreamPlayer" parent="."]
autoplay = true

[node name="Set" type="AudioStreamPlayer" parent="."]
stream = SubResource("gen")
playing = true

[node name="Spatial" type="AudioStreamPlayer3D" parent="."]
stream = SubResource("gen")
autoplay = true

[node name="Flat" type="AudioStreamPlayer2D" parent="."]
stream = SubResource("gen")
autoplay = true
`;

function openPlayback(): Scene {
  return openScene({
    source: PLAYBACK,
    rootScenePath: 'res://play.tscn',
    provider: { loadResource: async () => null },
  });
}

function textOf(value: SceneValue | null): string {
  return value !== null && typeof value === 'object' ? value.text : JSON.stringify(value);
}

// Each answer is what Godot 4.6.3 gives once the scene has entered the tree and run a frame (measured).
describe('the playback a running scene starts', () => {
  it('plays the autoplay animation a library holds', async () => {
    const scene = openPlayback();
    expect(textOf(await scene.getNode('Auto').get('current_animation'))).toBe('&"walk"');
    expect(textOf(await scene.getNode('Named').get('current_animation'))).toBe('&"moves/walk"');
  });

  it('plays nothing with no autoplay, or an autoplay no library holds', async () => {
    const scene = openPlayback();
    expect(textOf(await scene.getNode('Still').get('current_animation'))).toBe('&""');
    expect(textOf(await scene.getNode('Missing').get('current_animation'))).toBe('&""');
  });

  it('plays an autoplay stream in each audio player', async () => {
    const scene = openPlayback();
    for (const path of ['Music', 'Spatial', 'Flat'])
      expect(await scene.getNode(path).get('playing')).toBe(true);
  });

  it('plays no stream without autoplay, even where the file sets playing', async () => {
    const scene = openPlayback();
    expect(await scene.getNode('Set').get('playing')).toBe(false);
  });

  it('plays nothing with no stream', async () => {
    expect(await openPlayback().getNode('NoStream').get('playing')).toBe(false);
  });
});
