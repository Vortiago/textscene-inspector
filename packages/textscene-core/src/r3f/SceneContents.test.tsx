import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents } from './SceneContents';
import { TiledUploadQueue } from './tiledUpload/TiledUploadQueue';

describe('<TscnSceneContents> (preview lighting)', () => {
  it('mounts the preview sun for a scene that supplies no light of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    expect(renderer.scene.findAllByType('DirectionalLight')).toHaveLength(1);
  });

  it('places it at Godot’s preview angles, casting a shadow', async () => {
    // Altitude 60°, azimuth 150°: the light travels (-0.25, -0.866, 0.433), so it sits opposite.
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    const sun = renderer.scene.findByType('DirectionalLight');
    const position = sun.instance.position as THREE.Vector3;

    expect(position.clone().normalize().y).toBeCloseTo(0.866025, 4);
    expect(position.clone().normalize().x).toBeCloseTo(0.25, 4);
    expect(sun.instance.castShadow).toBe(true);
  });

  it('adds no flat ambient light — the preview environment is a sky, not a constant', async () => {
    // Godot's preview environment lights the scene through its sky's radiance.
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    expect(renderer.scene.findAllByType('AmbientLight')).toHaveLength(0);
  });
});

describe('<TscnSceneContents> tiled uploads', () => {
  it('drives a tiled upload queue every frame, so large textures upload in bands', async () => {
    const tick = vi.spyOn(TiledUploadQueue.prototype, 'tick');
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    tick.mockClear();
    await renderer.advanceFrames(2, 16);

    expect(tick).toHaveBeenCalledTimes(2);
    tick.mockRestore();
  });
});
