/**
 * `<VideoStreamPlayer>` — draws nothing, matching
 * `video_stream_player.cpp:174-184`'s `NOTIFICATION_DRAW` bailing on a null
 * `texture` (always null: no decoder in this codebase).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { VideoStreamPlayer } from './Component';

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = { name: 'V', type: 'VideoStreamPlayer', children: [], properties };
  return { ...emptySolveNode(), path: 'V', node: tscnNode };
}

describe('<VideoStreamPlayer> (isolated painter contract)', () => {
  it('renders no mesh with no stream authored', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VideoStreamPlayer {...painterEnv()} solveNode={node({})} rect={{ x: 0, y: 0, w: 64, h: 32 }} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('renders no mesh even with a stream and expand authored — video_stream_player.cpp:175 bails before reading either', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VideoStreamPlayer
        {...painterEnv()}
        solveNode={node({ stream: 'ExtResource("1_video")', expand: true })}
        rect={{ x: 0, y: 0, w: 320, h: 180 }}
        renderOrder={0}
      />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
