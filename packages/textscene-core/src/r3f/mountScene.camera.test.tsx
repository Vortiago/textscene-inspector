import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountScene } from './mountScene';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';

// A happy-dom render creates no WebGL context.
vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: () => <canvas />,
}));

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Box" type="Node3D" parent="."]

[node name="Top" type="Camera3D" parent="."]
`;

function sceneView(options?: Parameters<typeof mountScene>[2]) {
  const host = document.createElement('div');
  document.body.append(host);
  return mountScene(host, openScene({ source: SCENE, provider: NO_FILES }), options);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the camera option of a mounted view', () => {
  it('mounts through a Camera3D', async () => {
    const view = await act(async () => sceneView({ mode: '3D', camera: 'Top' }));

    expect(() => view.update({ camera: null })).not.toThrow();
    view.dispose();
  });

  it('refuses to mount through a node that is not a Camera3D', () => {
    expect(() => sceneView({ mode: '3D', camera: 'Box' })).toThrow(
      'expected a Camera3D at "Box", got a Node3D'
    );
  });

  it('refuses an update to a node that is not a Camera3D', async () => {
    const view = await act(async () => sceneView({ mode: '3D', camera: 'Top' }));

    expect(() => view.update({ camera: 'Box' })).toThrow('expected a Camera3D at "Box", got a Node3D');
    view.dispose();
  });

  it('mounts through a path that names no node yet, since a load may bring the camera in', async () => {
    const view = await act(async () => sceneView({ mode: '3D', camera: 'Crane/Lens' }));

    expect(() => view.update({ camera: 'Crane/Lens' })).not.toThrow();
    view.dispose();
  });
});
