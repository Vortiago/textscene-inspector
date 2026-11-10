/**
 * A VideoStreamPlayer's stream is a `.ogv` on the resource bus. The walk reads its picture size
 * into `textureSlots` as it reads any resource file's texture size.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { fixturesDir } from '../../../parser/testing/parserKit';
import { parseTheoraVideo } from '../../../resources/formats/theoravideo/parse';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { useBuildSolveTree } from './buildSolveTree';
import '../../nodes/index';
import '../index';

const CLIP_PATH = 'res://video/clip.ogv';
const EXTERNAL_RESOURCES = [{ id: '1_video', path: CLIP_PATH, type: 'VideoStream' }];

function player(): TscnNode {
  return {
    rawProperties: {},
    name: 'V',
    type: 'VideoStreamPlayer',
    children: [],
    properties: { name: 'V', stream: 'ExtResource("1_video")', expand: false },
  } as TscnNode;
}

function wrapperFor(loader: ReturnType<typeof createFakeResourceLoader>['loader']) {
  return ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
  );
}

describe('useBuildSolveTree — VideoStreamPlayer stream', () => {
  it('reads the picture size of a cached .ogv', () => {
    const fake = createFakeResourceLoader();
    const clip = readFileSync(resolve(fixturesDir(), 'video', 'clip-64x48.ogv'));
    fake.resources.seed(
      CLIP_PATH,
      parseTheoraVideo(clip.buffer.slice(clip.byteOffset, clip.byteOffset + clip.byteLength))
    );

    const { result } = renderHook(() => useBuildSolveTree([player()], EXTERNAL_RESOURCES, []), {
      wrapper: wrapperFor(fake.loader),
    });

    expect(result.current.tree[0]?.textureSlots.stream).toEqual({ x: 64, y: 48 });
  });

  it('reads no size until the .ogv has arrived', () => {
    const fake = createFakeResourceLoader();

    const { result } = renderHook(() => useBuildSolveTree([player()], EXTERNAL_RESOURCES, []), {
      wrapper: wrapperFor(fake.loader),
    });

    expect(result.current.tree[0]?.textureSlots.stream).toBeNull();
  });
});
