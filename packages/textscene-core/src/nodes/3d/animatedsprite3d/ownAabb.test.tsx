import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import { EMPTY_AABB } from '../../../godot/aabb';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../../resources/testing/createFakeResourceLoader';
import { parseAnimatedSprite3D } from './parser';
import { useAnimatedSprite3DAabb } from './ownAabb';

const EXTERNAL: TscnExternalResource[] = [{ id: 'coin', type: 'Texture2D', path: 'res://coin.png' }];
const FRAMES: TscnInternalResource = {
  id: 'frames',
  type: 'SpriteFrames',
  data: {
    animations:
      '[{"frames": [{"duration": 1.0, "texture": ExtResource("coin")}], "loop": true, "name": &"default", "speed": 5.0}]',
  },
};

function renderAabb(
  rawProperties: Record<string, string>,
  fake: FakeResourceLoader = createFakeResourceLoader()
) {
  const node: TscnNode = {
    name: 'Coin',
    type: 'AnimatedSprite3D',
    rawProperties,
    children: [],
    properties: parseAnimatedSprite3D(heading('AnimatedSprite3D', { name: 'Coin' }), rawProperties),
  };
  return renderHook(() => useAnimatedSprite3DAabb(node), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[FRAMES]} externalResources={EXTERNAL}>
          {children}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    ),
  }).result.current;
}

describe('useAnimatedSprite3DAabb', () => {
  it('sizes the quad from the frame texture and pixel_size', () => {
    const fake = createFakeResourceLoader();
    fake.textures.seed('res://coin.png', new THREE.Texture({ width: 32, height: 16 }));
    const aabb = renderAabb({ sprite_frames: 'SubResource("frames")', pixel_size: '0.1' }, fake);
    expect(aabb).toEqual({ position: { x: -1.6, y: -0.8, z: 0 }, size: { x: 3.2, y: 1.6, z: 0 } });
  });

  it('is unknown while the frame texture loads', () => {
    expect(renderAabb({ sprite_frames: 'SubResource("frames")' })).toBeNull();
  });

  it('is AABB() with no SpriteFrames, as the quad mesh starts', () => {
    expect(renderAabb({})).toBe(EMPTY_AABB);
  });
});
