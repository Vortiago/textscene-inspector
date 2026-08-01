/**
 * useSpriteFrames — the SpriteFrames slice's host adapter: it resolves the
 * `sprite_frames` reference from either home and hands the arriving property bag
 * to the slice decode.
 *
 * The two homes differ in exactly one load-bearing way, and that is what these
 * tests pin: an in-scene SubResource resolves its frame refs against the SCENE's
 * pools, while an external `.tres` resolves them against the FILE's own — its
 * frame `ExtResource("id")`s are scoped to the .tres, so borrowing the scene's
 * table would silently sample the wrong image.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';

import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../../resources/testing/createFakeResourceLoader';
import { useSpriteFrames } from './useSpriteFrames';

const SCENE_ANIMATIONS =
  '[{"frames": [{"duration": 1.0, "texture": ExtResource("3")}, {"duration": 2.0, "texture": ExtResource("3")}], "loop": true, "name": &"right", "speed": 5.0}]';

const SPRITE_FRAMES_SUB: TscnInternalResource = {
  id: 'sf',
  type: 'SpriteFrames',
  data: { id: 'sf', animations: SCENE_ANIMATIONS },
};

const SCENE_EXT: TscnExternalResource[] = [
  { id: '3', type: 'Texture2D', path: 'res://scene-frame.png' },
  { id: '7', type: 'SpriteFrames', path: 'res://frames.tres' },
  { id: '8', type: 'SpriteFrames', path: 'res://frames.res' },
];

/** A SpriteFrames `.tres` whose frame ids are scoped to the FILE, not the scene. */
const TRES = parseTresFile(
  `[gd_resource type="SpriteFrames" load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://sheet.png" id="1_sheet"]

[sub_resource type="AtlasTexture" id="AtlasTexture_1"]
atlas = ExtResource("1_sheet")
region = Rect2(0, 0, 16, 16)

[resource]
animations = [{"frames": [{"duration": 1.0, "texture": SubResource("AtlasTexture_1")}], "loop": false, "name": &"walk", "speed": 8.0}]
`
);

function harness(fake: FakeResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[SPRITE_FRAMES_SUB]} externalResources={SCENE_EXT}>
          {children}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  };
}

function renderSpriteFrames(ref: string | undefined, fake = createFakeResourceLoader()) {
  const result = renderHook(({ spriteFramesRef }) => useSpriteFrames(spriteFramesRef), {
    wrapper: harness(fake),
    initialProps: { spriteFramesRef: ref },
  });
  return { ...result, fake };
}

describe('useSpriteFrames — in-scene SubResource', () => {
  it('decodes the embedded SpriteFrames synchronously against the scene pools', () => {
    const { result } = renderSpriteFrames('SubResource("sf")');
    expect(result.current.status).toBe('loaded');
    const frames = result.current.spriteFrames!;
    expect([...frames.animations.keys()]).toEqual(['right']);
    expect(frames.animations.get('right')!.durations).toEqual([1, 2]);
    expect(frames.subResources).toEqual([SPRITE_FRAMES_SUB]);
    expect(frames.externalResources).toEqual(SCENE_EXT);
  });

  it('never requests a file for the embedded home', () => {
    const requested: string[] = [];
    const fake = createFakeResourceLoader();
    fake.resources.setRequestImpl((path) => requested.push(path));
    renderSpriteFrames('SubResource("sf")', fake);
    expect(requested).toEqual([]);
  });

  it('is unavailable when the SubResource id is not in the scene', () => {
    const { result } = renderSpriteFrames('SubResource("nope")');
    expect(result.current).toEqual({ spriteFrames: null, status: 'unavailable' });
  });

  it('is unavailable when the embedded SpriteFrames declares no animations', () => {
    const empty: TscnInternalResource = { id: 'sf', type: 'SpriteFrames', data: { id: 'sf', animations: '[]' } };
    const { result } = renderHook(() => useSpriteFrames('SubResource("sf")'), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
          <SceneResourcesProvider internalResources={[empty]} externalResources={SCENE_EXT}>
            {children}
          </SceneResourcesProvider>
        </ResourceLoaderProvider>
      ),
    });
    expect(result.current).toEqual({ spriteFrames: null, status: 'unavailable' });
  });

  it('is unavailable for an absent reference', () => {
    const { result } = renderSpriteFrames(undefined);
    expect(result.current).toEqual({ spriteFrames: null, status: 'unavailable' });
  });
});

describe('useSpriteFrames — external .tres', () => {
  it('reports pending and requests the resolved path while the file is in flight', () => {
    const requested: string[] = [];
    const fake = createFakeResourceLoader();
    fake.resources.setRequestImpl((path) => requested.push(path));
    const { result } = renderSpriteFrames('ExtResource("7")', fake);
    expect(result.current).toEqual({ spriteFrames: null, status: 'pending' });
    expect(requested).toEqual(['res://frames.tres']);
  });

  it('decodes the arriving ParsedResource against the FILE\'s own pools', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://frames.tres', TRES);
    const { result } = renderSpriteFrames('ExtResource("7")', fake);
    expect(result.current.status).toBe('loaded');
    const frames = result.current.spriteFrames!;
    const walk = frames.animations.get('walk')!;
    expect(walk.frames).toEqual(['SubResource("AtlasTexture_1")']);
    expect(walk.fps).toBe(8);
    expect(walk.loop).toBe(false);
    // The file's tables, NOT the scene's — the frame's atlas id is scoped to it.
    expect(frames.subResources.map((r) => r.type)).toEqual(['AtlasTexture']);
    expect(frames.externalResources.map((r) => r.path)).toEqual(['res://sheet.png']);
  });

  it('decodes a late arrival (upload recovery) without remounting', () => {
    const fake = createFakeResourceLoader();
    const { result } = renderSpriteFrames('ExtResource("7")', fake);
    expect(result.current.status).toBe('pending');
    act(() => fake.resources._resolve('res://frames.tres', TRES));
    expect(result.current.status).toBe('loaded');
    expect([...result.current.spriteFrames!.animations.keys()]).toEqual(['walk']);
  });

  it('is unavailable when the file failed to load', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://frames.tres', null);
    const { result } = renderSpriteFrames('ExtResource("7")', fake);
    expect(result.current).toEqual({ spriteFrames: null, status: 'unavailable' });
  });

  it('resolves a raw res:// reference like an ExtResource one', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://frames.tres', TRES);
    const { result } = renderSpriteFrames('res://frames.tres', fake);
    expect(result.current.status).toBe('loaded');
  });

  it('does not park a request for a binary .res SpriteFrames (no processor would answer)', () => {
    const requested: string[] = [];
    const fake = createFakeResourceLoader();
    fake.resources.setRequestImpl((path) => requested.push(path));
    const { result } = renderSpriteFrames('ExtResource("8")', fake);
    expect(result.current).toEqual({ spriteFrames: null, status: 'unavailable' });
    expect(requested).toEqual([]);
  });

  it('is unavailable when the ExtResource id is not registered', () => {
    const { result } = renderSpriteFrames('ExtResource("404")');
    expect(result.current).toEqual({ spriteFrames: null, status: 'unavailable' });
  });
});

describe('useSpriteFrames — hook-call count', () => {
  it('survives switching homes on the same hook instance (constant hook count)', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://frames.tres', TRES);
    const { result, rerender } = renderSpriteFrames('SubResource("sf")', fake);
    expect([...result.current.spriteFrames!.animations.keys()]).toEqual(['right']);

    // The synchronous branch feeds `''` to useResource; if that hook were
    // conditional instead, this rerender would throw "Rendered more hooks…".
    rerender({ spriteFramesRef: 'ExtResource("7")' });
    expect([...result.current.spriteFrames!.animations.keys()]).toEqual(['walk']);

    rerender({ spriteFramesRef: undefined });
    expect(result.current.spriteFrames).toBeNull();
  });
});
