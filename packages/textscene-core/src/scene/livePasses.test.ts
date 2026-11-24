import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';
import { valueOfSceneValue, variant, type SceneValue } from './variant';
import type { ResourceProvider } from '../resources/ResourceProvider';

const MAIN = 'res://main.tscn';

const RELAYS = `[gd_scene format=3]

[node name="Level" type="Node2D"]

[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(100, 50)
rotation = 0.5
remote_path = NodePath("../Target")

[node name="Target" type="Node2D" parent="."]
position = Vector2(7, 8)

[node name="Cam" type="Camera2D" parent="Target"]
position = Vector2(10, 0)

[node name="Space" type="Node3D" parent="."]

[node name="Relay3D" type="RemoteTransform3D" parent="Space"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)
remote_path = NodePath("../Target3D")

[node name="Target3D" type="Node3D" parent="Space"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 9, 9, 9)
`;

const noFiles: ResourceProvider = { loadResource: async () => null };

const relayScene = () => openScene({ source: RELAYS, provider: noFiles, rootScenePath: MAIN });

function componentsOf(value: SceneValue | null): readonly number[] {
  const read = valueOfSceneValue(value!);
  if (!('value' in read) || !Array.isArray(read.value))
    throw new Error(`expected a vector, got ${read.type}`);
  return read.value as readonly number[];
}

// Each answer is measured in Godot 4.6.3 on this scene from its second frame, once each relay has pushed.
describe('a node a RemoteTransform moves', () => {
  it('answers the position the 2D relay gives it', async () => {
    const target = relayScene().getNode('Target');
    await vi.waitFor(async () => expect(await target.get('position')).toEqual(variant('Vector2(100, 50)')));
  });

  it('answers the rotation the 2D relay gives it', async () => {
    const target = relayScene().getNode('Target');
    await vi.waitFor(async () => expect(await target.get('rotation')).toBe(0.5));
  });

  it('carries its children to the pose the relay gives it', async () => {
    const camera = relayScene().getNode('Target/Cam');
    await vi.waitFor(async () => {
      const [x, y] = componentsOf(await camera.get('global_position'));
      expect(x).toBeCloseTo(108.7758, 4);
      expect(y).toBeCloseTo(54.79425, 4);
    });
  });

  it('answers the transform the 3D relay gives it', async () => {
    const target = relayScene().getNode('Space/Target3D');
    await vi.waitFor(async () =>
      expect(await target.get('transform')).toEqual(
        variant('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)')
      )
    );
  });
});
