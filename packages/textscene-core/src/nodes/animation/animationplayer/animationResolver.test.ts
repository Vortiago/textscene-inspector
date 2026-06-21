/**
 * animationResolver tests — render-side resolution of AnimationLibrary +
 * Animation SubResources into GodotAnimation[] (THREE-free).
 */

import { describe, it, expect } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveAnimations } from './animationResolver';
import type { AnimationLibraryRef, AnimationPlayerProperties } from './types';
import { TscnParser } from '../../../parser/TscnParser';

function res(id: string, type: string, data: Record<string, string>): TscnInternalResource {
  return { id, type, data };
}

const DEFAULT_LIB: AnimationLibraryRef[] = [{ name: '', subResourceId: 'Lib' }];

describe('resolveAnimations — library resolution (B1)', () => {
  it('resolves the AnimationLibrary._data map to its named Animations', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', {
        _data: '{\n"idle": SubResource("Anim_idle"),\n"walk": SubResource("Anim_walk")\n}',
      }),
      res('Anim_idle', 'Animation', { length: '1.0' }),
      res('Anim_walk', 'Animation', { length: '0.8' }),
    ];
    const anims = resolveAnimations(DEFAULT_LIB, internal);
    expect(anims.map((a) => a.name).sort()).toEqual(['idle', 'walk']);
  });

  it('returns [] when the referenced library is absent', () => {
    expect(resolveAnimations(DEFAULT_LIB, [])).toEqual([]);
  });

  it('skips a clip whose Animation SubResource is missing', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"idle": SubResource("Anim_idle")\n}' }),
    ];
    expect(resolveAnimations(DEFAULT_LIB, internal)).toEqual([]);
  });
});

describe('resolveAnimations — animation scalars (B2)', () => {
  it('reads length, loop_mode and step with Godot defaults', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"idle": SubResource("A")\n}' }),
      res('A', 'Animation', { length: '2.5', loop_mode: '1', step: '0.05' }),
    ];
    const [anim] = resolveAnimations(DEFAULT_LIB, internal);
    expect(anim).toMatchObject({ name: 'idle', length: 2.5, loopMode: 1, step: 0.05 });
  });

  it('defaults length=1, loop_mode=0, step=0.1 when absent', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"idle": SubResource("A")\n}' }),
      res('A', 'Animation', {}),
    ];
    const [anim] = resolveAnimations(DEFAULT_LIB, internal);
    expect(anim).toMatchObject({ length: 1.0, loopMode: 0, step: 0.1 });
  });
});

describe('resolveAnimations — value track parsing (B3)', () => {
  it('parses a value track: target node, property, interp and keyframe times', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"spin": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Circle:rotation")',
        'tracks/0/interp': '1',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 0.5, 1),\n"transitions": PackedFloat32Array(1, 1, 1),\n"update": 0,\n"values": [Vector3(0, 0, 0), Vector3(0, 1.5, 0), Vector3(0, 3, 0)]\n}',
      }),
    ];
    const [anim] = resolveAnimations(DEFAULT_LIB, internal);
    expect(anim.tracks).toHaveLength(1);
    const t = anim.tracks[0];
    expect(t).toMatchObject({ type: 'value', targetPath: 'Circle', property: 'rotation', interp: 1 });
    expect(t.keys.map((k) => k.time)).toEqual([0, 0.5, 1]);
    expect(t.keys.map((k) => k.transition)).toEqual([1, 1, 1]);
  });
});

describe('resolveAnimations — keyframe values (B4)', () => {
  it('decodes Vector3 keyframe values to number triples', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("N:position")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 1),\n"values": [Vector3(1, 2, 3), Vector3(4, 5, 6)]\n}',
      }),
    ];
    const [anim] = resolveAnimations(DEFAULT_LIB, internal);
    expect(anim.tracks[0].keys.map((k) => k.value)).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it('decodes Vector2 and scalar float keyframe values', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("N:position")',
        'tracks/0/keys': '{\n"times": PackedFloat32Array(0),\n"values": [Vector2(7, -8)]\n}',
        'tracks/1/type': '"value"',
        'tracks/1/path': 'NodePath("N:rotation")',
        'tracks/1/keys': '{\n"times": PackedFloat32Array(0),\n"values": [1.5708]\n}',
      }),
    ];
    const [anim] = resolveAnimations(DEFAULT_LIB, internal);
    expect(anim.tracks[0].keys[0].value).toEqual([7, -8]);
    expect(anim.tracks[1].keys[0].value).toBe(1.5708);
  });
});

describe('resolveAnimations — graceful degradation (B5)', () => {
  it('skips a track with no keys but keeps the rest of the animation', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Broken:position")',
        // no keys
        'tracks/1/type': '"value"',
        'tracks/1/path': 'NodePath("Good:position")',
        'tracks/1/keys': '{\n"times": PackedFloat32Array(0),\n"values": [Vector3(0, 0, 0)]\n}',
      }),
    ];
    const [anim] = resolveAnimations(DEFAULT_LIB, internal);
    expect(anim.tracks.map((t) => t.targetPath)).toEqual(['Good']);
  });

  it('returns the animation with no tracks when a track type is unsupported', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"method"',
        'tracks/0/path': 'NodePath(".")',
      }),
    ];
    const [anim] = resolveAnimations(DEFAULT_LIB, internal);
    expect(anim.tracks).toEqual([]);
  });
});

describe('resolveAnimations — end-to-end from a parsed dict-form scene', () => {
  // Regression for the symptom "AnimationPlayer shows no animations": a scene
  // using Godot 4's dictionary-form `libraries = { "": SubResource(...) }` must
  // resolve its animations through the full parse → resolve chain.
  it('resolves animations declared via the dictionary-form libraries property', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[sub_resource type="Animation" id="Animation_spin"]
resource_name = "spin"
length = 1.0

[sub_resource type="AnimationLibrary" id="AnimationLibrary_1"]
_data = {
"spin": SubResource("Animation_spin")
}

[node name="AnimationPlayer" type="AnimationPlayer"]
libraries = {
"": SubResource("AnimationLibrary_1")
}
`);

    const findAp = (nodes: typeof scene.nodes): (typeof scene.nodes)[number] | undefined => {
      for (const n of nodes) {
        if (n.type === 'AnimationPlayer') return n;
        const hit = findAp(n.children);
        if (hit) return hit;
      }
      return undefined;
    };
    const ap = findAp(scene.nodes);
    const libraries = (ap?.properties as AnimationPlayerProperties).libraries;

    expect(libraries).toEqual([{ name: '', subResourceId: 'AnimationLibrary_1' }]);
    const anims = resolveAnimations(libraries, scene.internalResources);
    expect(anims.map((a) => a.name)).toEqual(['spin']);
  });
});
