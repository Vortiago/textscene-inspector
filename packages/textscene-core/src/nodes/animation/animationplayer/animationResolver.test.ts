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
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim).toMatchObject({ name: 'idle', length: 2.5, loopMode: 1, step: 0.05 });
  });

  it('defaults length=1, loop_mode=0, step=0.1 when absent', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"idle": SubResource("A")\n}' }),
      res('A', 'Animation', {}),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
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
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks).toHaveLength(1);
    const t = anim.tracks[0]!;
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
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks[0]!.keys.map((k) => k.value)).toEqual([[1, 2, 3], [4, 5, 6]]);
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
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks[0]!.keys[0]!.value).toEqual([7, -8]);
    expect(anim.tracks[1]!.keys[0]!.value).toBe(1.5708);
  });

  it('decodes the `i`-suffixed vectors, which share a prefix with their float twins', () => {
    // `'Vector2i(...)'.startsWith('Vector2')` is TRUE, so the integer literal
    // reached `parseVector2`, missed its float grammar and THREW — taking the
    // whole scene down rather than one keyframe. `SubViewport.size` is declared
    // `Variant::VECTOR2I` (viewport.cpp:5579), so this is what Godot writes.
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("SubViewport:size")',
        'tracks/0/keys': '{\n"times": PackedFloat32Array(0),\n"values": [Vector2i(256, 128)]\n}',
        'tracks/1/type': '"value"',
        'tracks/1/path': 'NodePath("GridMap:cell")',
        'tracks/1/keys': '{\n"times": PackedFloat32Array(0),\n"values": [Vector3i(1, -2, 3)]\n}',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks[0]!.keys[0]!.value).toEqual([256, 128]);
    expect(anim.tracks[1]!.keys[0]!.value).toEqual([1, -2, 3]);
  });

  it('decodes Color keyframe values to RGBA quadruples (modulate fade — ADR-0017)', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Decal:modulate")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 1),\n"values": [Color(1, 1, 1, 1), Color(1, 0.5, 0.25, 0)]\n}',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks[0]!.keys.map((k) => k.value)).toEqual([
      [1, 1, 1, 1],
      [1, 0.5, 0.25, 0],
    ]);
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
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks.map((t) => t.targetPath)).toEqual(['Good']);
  });

  // `inf` is a legal float literal Godot writes and reloads
  // (variant_parser.cpp:150-155), outside the finite grammar the render
  // decoders read. Such a key has no value to interpolate, so the track goes
  // rather than becoming one that samples NaN for the rest of the clip.
  it('drops a value track whose FIRST key holds a non-finite component', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Fading:modulate")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 1),\n"values": [Color(1, 1, 1, inf), Color(1, 1, 1, 0)]\n}',
        'tracks/1/type': '"value"',
        'tracks/1/path': 'NodePath("Good:position")',
        'tracks/1/keys': '{\n"times": PackedFloat32Array(0),\n"values": [Vector3(0, 0, 0)]\n}',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks.map((t) => t.targetPath)).toEqual(['Good']);
  });

  it('drops a value track whose non-finite component is in a LATER key', () => {
    // Every downstream shape check reads key 0, so a good first key is exactly
    // the case that reached a KeyframeTrack.
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Fading:modulate")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 0.5, 1),\n"values": [Color(1, 1, 1, 1), Color(1, 1, 1, 0.5), Color(1, 1, 1, inf)]\n}',
        'tracks/1/type': '"value"',
        'tracks/1/path': 'NodePath("Good:position")',
        'tracks/1/keys': '{\n"times": PackedFloat32Array(0),\n"values": [Vector3(0, 0, 0)]\n}',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks.map((t) => t.targetPath)).toEqual(['Good']);
  });

  it('drops a value track whose key overflows the finite grammar to Infinity', () => {
    // `1e999` is ordinary digits and an exponent, so no grammar refuses it —
    // only the read result is non-finite.
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("N:position")',
        'tracks/0/keys': '{\n"times": PackedFloat32Array(0),\n"values": [Vector3(0, 1e999, 0)]\n}',
      }),
    ];
    expect(resolveAnimations(DEFAULT_LIB, internal)[0]!.tracks).toEqual([]);
  });

  // `times`, `transitions` and a transform track's flat array are the same
  // channel as `values`: a non-finite one reaches a THREE `KeyframeTrack`, whose
  // interpolant divides by the span, so every sample after it is NaN.
  it('drops a value track whose TIME is non-finite', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Fading:position")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, inf),\n"values": [Vector3(0, 0, 0), Vector3(0, 1, 0)]\n}',
        'tracks/1/type': '"value"',
        'tracks/1/path': 'NodePath("Good:position")',
        'tracks/1/keys': '{\n"times": PackedFloat32Array(0),\n"values": [Vector3(0, 0, 0)]\n}',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks.map((t) => t.targetPath)).toEqual(['Good']);
  });

  it('drops a value track whose TRANSITION is non-finite', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Fading:position")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 1),\n"transitions": PackedFloat32Array(1, nan),\n"values": [Vector3(0, 0, 0), Vector3(0, 1, 0)]\n}',
      }),
    ];
    expect(resolveAnimations(DEFAULT_LIB, internal)[0]!.tracks).toEqual([]);
  });

  it('drops a 3D transform track whose flat array holds a non-finite component', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"position_3d"',
        'tracks/0/path': 'NodePath("N")',
        'tracks/0/keys': 'PackedFloat32Array(0, 1, 0, inf, 0, 1, 1, 0, 1, 0)',
      }),
    ];
    expect(resolveAnimations(DEFAULT_LIB, internal)[0]!.tracks).toEqual([]);
  });

  it('drops a value track whose TIME is non-finite on a transform track too', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"rotation_3d"',
        'tracks/0/path': 'NodePath("N")',
        'tracks/0/keys': 'PackedFloat32Array(0, 1, 0, 0, 0, 1, 1e999, 1, 0, 0, 0, 1)',
      }),
    ];
    expect(resolveAnimations(DEFAULT_LIB, internal)[0]!.tracks).toEqual([]);
  });

  // `values[i] ?? 0` minted a keyframe AT ZERO for every time the array did not
  // reach, which for a scalar property pins the node there for the whole clip.
  it('drops a value track whose keys dict carries no `values` at all', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("N:rotation")',
        'tracks/0/keys': '{\n"times": PackedFloat32Array(0, 1)\n}',
      }),
    ];
    expect(resolveAnimations(DEFAULT_LIB, internal)[0]!.tracks).toEqual([]);
  });

  it('drops a value track with fewer values than times', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("N:position")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 0.5, 1),\n"values": [Vector2(0, 0), Vector2(1, 1)]\n}',
      }),
    ];
    expect(resolveAnimations(DEFAULT_LIB, internal)[0]!.tracks).toEqual([]);
  });

  it('drops a value track whose int component is unstorable, rather than keying 0', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("N:position")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0),\n"values": [Vector3i(99999999999999999999, 0, 0)]\n}',
      }),
    ];
    expect(resolveAnimations(DEFAULT_LIB, internal)[0]!.tracks).toEqual([]);
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
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks).toEqual([]);
  });

  it('a method track contributes nothing (not even a placeholder) alongside a resolving value track', () => {
    // A mixed clip (method call + transform track) keeps only what the
    // parser understands — the method track is filtered out entirely
    // during resolution, never becoming a GodotTrack of any type.
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"mixed": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"method"',
        'tracks/0/path': 'NodePath("Mesh")',
        'tracks/0/keys': '{\n"times": PackedFloat32Array(0),\n"values": [{"method": &"set_modulate"}]\n}',
        'tracks/1/type': '"value"',
        'tracks/1/path': 'NodePath("Mesh:position")',
        'tracks/1/keys':
          '{\n"times": PackedFloat32Array(0, 1),\n"values": [Vector3(0, 0, 0), Vector3(0, 2, 0)]\n}',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks).toHaveLength(1);
    expect(anim.tracks[0]).toMatchObject({ type: 'value', targetPath: 'Mesh', property: 'position' });
  });
});

describe('resolveAnimations — 3D transform tracks (position_3d/rotation_3d/scale_3d)', () => {
  // Godot 4's dedicated 3D transform tracks store keys as a flat
  // PackedFloat32Array(time, transition, comps…) — NOT the value-track dict —
  // and the property is implied by the track type, not a NodePath `:suffix`.
  it('decodes a position_3d flat key array to Vector3 values on the position property', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"move": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"position_3d"',
        'tracks/0/path': 'NodePath("Mesh")',
        'tracks/0/interp': '1',
        // two keys: (time, transition, x, y, z)
        'tracks/0/keys': 'PackedFloat32Array(0, 1, 0, 0, 0, 0.5, 1, 1, 2, 3)',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks).toHaveLength(1);
    const t = anim.tracks[0]!;
    expect(t).toMatchObject({ type: 'position_3d', targetPath: 'Mesh', property: 'position', interp: 1 });
    expect(t.keys.map((k) => k.time)).toEqual([0, 0.5]);
    expect(t.keys.map((k) => k.value)).toEqual([[0, 0, 0], [1, 2, 3]]);
  });

  it('decodes a scale_3d flat key array to Vector3 values on the scale property', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"scale_3d"',
        'tracks/0/path': 'NodePath("Mesh")',
        'tracks/0/keys': 'PackedFloat32Array(0, 1, 2, 2, 2)',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks[0]).toMatchObject({ type: 'scale_3d', property: 'scale' });
    expect(anim.tracks[0]!.keys[0]!.value).toEqual([2, 2, 2]);
  });

  it('decodes a rotation_3d flat key array to quaternion (4-component) values', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"rotation_3d"',
        'tracks/0/path': 'NodePath("Mesh")',
        // (time, transition, qx, qy, qz, qw)
        'tracks/0/keys': 'PackedFloat32Array(0, 1, 0.707107, 0, 0, 0.707107)',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks[0]).toMatchObject({ type: 'rotation_3d', property: 'quaternion' });
    expect(anim.tracks[0]!.keys[0]!.value).toEqual([0.707107, 0, 0, 0.707107]);
  });

  it('reads the per-key transition from the flat array (second component)', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"position_3d"',
        'tracks/0/path': 'NodePath("Mesh")',
        'tracks/0/keys': 'PackedFloat32Array(0, 0.25, 1, 1, 1)',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks[0]!.keys[0]!.transition).toBe(0.25);
  });

  it('skips skeletal bone sub-path tracks (Node:bone) but keeps plain-node tracks', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"position_3d"',
        'tracks/0/path': 'NodePath("Skeleton/Skeleton3D:body")',
        'tracks/0/keys': 'PackedFloat32Array(0, 1, 0, 0.66, 0)',
        'tracks/1/type': '"position_3d"',
        'tracks/1/path': 'NodePath("Mesh")',
        'tracks/1/keys': 'PackedFloat32Array(0, 1, 1, 2, 3)',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks.map((t) => t.targetPath)).toEqual(['Mesh']);
  });

  it('does not treat an Object.prototype key (e.g. "constructor") as a transform track type', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"constructor"',
        'tracks/0/path': 'NodePath("Mesh")',
        'tracks/0/keys': 'PackedFloat32Array(0, 1, 1, 2, 3)',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim.tracks).toEqual([]);
  });

  it('skips a 3D transform track whose flat array is shorter than one stride', () => {
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"a": SubResource("A")\n}' }),
      res('A', 'Animation', {
        'tracks/0/type': '"position_3d"',
        'tracks/0/path': 'NodePath("Mesh")',
        'tracks/0/keys': 'PackedFloat32Array(0, 1)', // missing the 3 components
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
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

  // Regression for the symptom "3D animations don't move": a Godot-4
  // position_3d track (flat PackedFloat32Array keys) must resolve to a
  // position track through the full parse → resolve chain.
  it('resolves a position_3d transform track from a parsed scene', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[sub_resource type="Animation" id="Animation_move"]
resource_name = "move"
length = 1.0
tracks/0/type = "position_3d"
tracks/0/path = NodePath("Mesh")
tracks/0/keys = PackedFloat32Array(0, 1, 0, 0, 0, 1, 1, 0, 2, 0)

[sub_resource type="AnimationLibrary" id="AnimationLibrary_1"]
_data = {
"move": SubResource("Animation_move")
}

[node name="AnimationPlayer" type="AnimationPlayer"]
libraries = {
"": SubResource("AnimationLibrary_1")
}
`);
    const ap = scene.nodes.find((n) => n.type === 'AnimationPlayer');
    const libraries = (ap?.properties as AnimationPlayerProperties).libraries;
    const anims = resolveAnimations(libraries, scene.internalResources);

    expect(anims).toHaveLength(1);
    const t = anims[0]!.tracks[0]!;
    expect(t).toMatchObject({ targetPath: 'Mesh', property: 'position' });
    expect(t.keys.map((k) => k.value)).toEqual([[0, 0, 0], [0, 2, 0]]);
  });
});

describe('resolveAnimations — a scalar the tokenizer cannot read', () => {
  it('falls back rather than reading a prefix of it', () => {
    // `parseFloat('5abc')` is 5, so a token Godot refuses to load produced a
    // five-second clip and every keyframe time was scaled against it.
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"idle": SubResource("A")\n}' }),
      res('A', 'Animation', { length: '5abc', step: '2abc' }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;
    expect(anim).toMatchObject({ length: 1.0, step: 0.1 });
  });
});

describe('a fractional composite keyframe', () => {
  it('keeps its fractional components, because a keyframe is not a slot write', () => {
    // `{ exact: true }` on COMPOSITE_KEYS. Without it the widened `Vector3i`
    // arm matches `Vector3(...)` first and every component is truncated —
    // `[0, 1.5, 0]` silently became `[0, 1, 0]` with the whole suite green.
    const internal = [
      res('Lib', 'AnimationLibrary', { _data: '{\n"spin": SubResource("A")\n}' }),
      res('A', 'Animation', {
        length: '1.0',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Pivot:rotation")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 1),\n"transitions": PackedFloat32Array(1, 1),\n' +
          '"update": 0,\n"values": [Vector3(0, 0, 0), Vector3(0, 1.5, 0)]\n}',
      }),
    ];
    const anim = resolveAnimations(DEFAULT_LIB, internal)[0]!;

    expect(anim.tracks[0]!.keys.map((k) => k.value)).toEqual([
      [0, 0, 0],
      [0, 1.5, 0],
    ]);
  });
});
