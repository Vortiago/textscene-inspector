import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from 'react';
import { GameViewContents } from './gameView/GameViewContents';
import { TscnSceneProvider } from './TscnSceneProvider';
import { resourcePipelineOf } from './sceneResourcePipeline';
import { openScene } from '../scene/openScene';
import { variant } from '../scene/variant';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { createTextureFromBuffer } from '../resources/formats/image/textureProcessing';
import { settleLoads } from './testing/settleLoads';
import './nodes';

vi.mock('../resources/formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../resources/formats/image/textureProcessing')>();
  return { ...actual, createTextureFromBuffer: vi.fn() };
});

// happy-dom decodes no image.
vi.mocked(createTextureFromBuffer).mockImplementation(async () => new THREE.Texture());

const ICON_PATH = 'res://icon.png';

const SPRITE = `[gd_scene format=3]

[ext_resource type="Texture2D" path="${ICON_PATH}" id="1"]

[node name="Main" type="Sprite2D"]
texture = ExtResource("1")
`;

const ICON = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

/** A provider with no file until `arrive` gives it the icon. */
function lateIcon() {
  let icon: ArrayBuffer | null = null;
  const provider: ResourceProvider = {
    loadResource: async (path) => (path === ICON_PATH ? icon : null),
  };
  return { provider, arrive: () => (icon = ICON) };
}

async function drawScene(provider: ResourceProvider) {
  const scene = openScene({ source: SPRITE, provider });
  let notices = 0;
  scene.subscribe(() => notices++);
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <GameViewContents />
    </TscnSceneProvider>
  );
  await settleLoads();
  await renderer.advanceFrames(2, 1 / 60);
  return { scene, renderer, notices: () => notices };
}

describe('the missing files of a scene', () => {
  it('holds a texture path the provider answers null for, and tells the subscribers', async () => {
    const { scene, notices } = await drawScene(lateIcon().provider);
    expect([...scene.missingFiles()]).toEqual([ICON_PATH]);
    expect(notices()).toBeGreaterThan(0);
  });

  it('lets go of a file that loads after it was missing', async () => {
    const { provider, arrive } = lateIcon();
    const { scene, renderer } = await drawScene(provider);
    arrive();
    await act(async () => resourcePipelineOf(scene).loader.provideFile(ICON_PATH));
    await settleLoads();
    await renderer.advanceFrames(2, 1 / 60);
    expect(scene.missingFiles().size).toBe(0);
  });

  it('is empty for a scene no view has drawn', () => {
    const scene = openScene({ source: SPRITE, provider: lateIcon().provider });
    expect(scene.missingFiles().size).toBe(0);
  });

  it('lets go of a file after a write that stops reading it', async () => {
    const { scene, renderer } = await drawScene(lateIcon().provider);
    await act(async () => void (await scene.getNode('.').set('texture', variant('null'))));
    await renderer.advanceFrames(2, 1 / 60);
    expect(scene.missingFiles().size).toBe(0);
  });
});
