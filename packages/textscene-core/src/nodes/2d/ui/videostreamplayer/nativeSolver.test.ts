/**
 * `videoStreamPlayerMinimumSize` (`video_stream_player.cpp:232-238`): always `Size2()` here,
 * since nothing decodes a `VideoStream` frame, so `texture.is_valid()` is always false.
 */

import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { videoStreamPlayerMinimumSize } from './nativeSolver';

const CTX: SolveContext = {
  theme: nativeTheme(1),
  measureText: null,
  combinedMinimumSize: () => ({ x: 0, y: 0 }),
};

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = { name: 'V', type: 'VideoStreamPlayer', children: [], properties };
  return { ...emptySolveNode(), path: 'V', node: tscnNode };
}

describe('videoStreamPlayerMinimumSize', () => {
  it('is (0, 0) with no properties authored', () => {
    expect(videoStreamPlayerMinimumSize(node({}), CTX)).toEqual({ x: 0, y: 0 });
  });

  it('stays (0, 0) with expand true and a stream assigned — video_stream_player.cpp:233', () => {
    expect(
      videoStreamPlayerMinimumSize(node({ expand: true, stream: 'ExtResource("1_video")' }), CTX)
    ).toEqual({ x: 0, y: 0 });
  });

  it('stays (0, 0) with expand false — video_stream_player.cpp:233 still gates on a texture that never resolves', () => {
    expect(videoStreamPlayerMinimumSize(node({ expand: false }), CTX)).toEqual({ x: 0, y: 0 });
  });
});
