/**
 * `videoStreamPlayerMinimumSize` (`video_stream_player.cpp:232-238`): the stream's picture size
 * with `expand` off, else `Size2()`.
 */

import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { theoraPictureSizeOf } from '../../../../resources/formats/theoravideo/parse';
import { videoStreamPlayerMinimumSize, videoStreamPlayerTextureSlots } from './nativeSolver';

const CTX: SolveContext = {
  theme: nativeTheme(1),
  measureText: null,
  combinedMinimumSize: () => ({ x: 0, y: 0 }),
};

function node(properties: Record<string, unknown>, textureSlots: SolveNode['textureSlots'] = {}): SolveNode {
  const tscnNode: TscnNode = controlNode('V', 'VideoStreamPlayer', properties);
  return { ...emptySolveNode(), path: 'V', node: tscnNode, textureSlots };
}

const PICTURE = { stream: { x: 64, y: 48 } };

describe('videoStreamPlayerMinimumSize', () => {
  it('is the picture size with expand off — video_stream_player.cpp:233', () => {
    expect(videoStreamPlayerMinimumSize(node({ expand: false }, PICTURE), CTX)).toEqual({ x: 64, y: 48 });
  });

  it('is (0, 0) with expand on — video_stream_player.cpp:233', () => {
    expect(videoStreamPlayerMinimumSize(node({ expand: true }, PICTURE), CTX)).toEqual({ x: 0, y: 0 });
  });

  it('is (0, 0) while the stream has not resolved', () => {
    expect(videoStreamPlayerMinimumSize(node({ expand: false }, { stream: null }), CTX)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('is (0, 0) with no stream authored', () => {
    expect(videoStreamPlayerMinimumSize(node({}), CTX)).toEqual({ x: 0, y: 0 });
  });
});

describe('videoStreamPlayerTextureSlots', () => {
  it('asks for the stream under the key the solver reads', () => {
    const requests = videoStreamPlayerTextureSlots(
      controlNode('V', 'VideoStreamPlayer', { stream: 'ExtResource("1")' })
    );
    expect(requests).toEqual([{ key: 'stream', ref: 'ExtResource("1")', sizeOfFile: theoraPictureSizeOf }]);
  });

  it('asks for nothing with no stream authored', () => {
    expect(videoStreamPlayerTextureSlots(controlNode('V', 'VideoStreamPlayer', {}))).toEqual([]);
  });
});
