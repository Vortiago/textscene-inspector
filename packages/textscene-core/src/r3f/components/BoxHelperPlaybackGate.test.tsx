/**
 * PERF: gate the selection/hover BoxHelper's per-frame recompute.
 *
 * `useSceneHelper` defaults `tickUpdate` to true, so before this fix
 * `<SelectionHighlight>`/`<HoverHighlight>` ran `updateWorldMatrix(true,true)`
 * + a full subtree traverse every frame forever, even for a fully static
 * scene with nothing selected moving. The box only needs to recompute:
 *   - once, when the selection/hover target changes (already covered — a
 *     new target re-runs the helper's creation effect, and `THREE.BoxHelper`'s
 *     constructor calls the (overridden) `update()` synchronously), and
 *   - every frame while something could actually be moving, i.e. while the
 *     shared AnimationTransport is 'playing' OR 'paused' (a paused scrub still
 *     seeks the mixer — see usePlaybackLoop's paused branch).
 * It must NOT recompute every frame while `playState === 'stopped'`.
 */
import { useEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../parser/types';
import { TscnSceneContents } from '../TscnCanvas';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../contexts/SelectionContext';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
  type PlayerRegistration,
} from '../contexts/AnimationTransportContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import { WorldBoxHelper } from './WorldBoxHelper';
import type { MeshInstance3DProperties } from '../../nodes/3d/meshinstance3d/types';

import '../nodes/index';

function makeMeshInstance(name: string): TscnNode {
  const props: MeshInstance3DProperties = { name, surfaceMaterialOverrides: new Map() };
  return { name, type: 'MeshInstance3D', children: [], properties: props };
}

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

const REG: PlayerRegistration = { clips: ['clip'], durations: { clip: 10 } };

let transport: AnimationTransport;
function TransportCapture() {
  transport = useAnimationTransport();
  return null;
}

/** One provider stack for every gating test: a selected Cube + `extra` transport drivers. */
function mountGated(extra?: ReactNode) {
  const graph = createSceneGraphFromTscnScene({ nodes: [makeMeshInstance('Cube')] });
  return ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <SelectionProvider>
        <AnimationTransportProvider>
          <SelectSeeder path="Cube" />
          <TransportCapture />
          {extra}
          <TscnSceneContents />
        </AnimationTransportProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
}

/** Registers a trivial player, then plays it once the default clip resolves. */
function RegisterAndPlay() {
  const { registerPlayer, selectedClip, play } = useAnimationTransport();
  useEffect(() => registerPlayer(REG), [registerPlayer]);
  useEffect(() => {
    if (selectedClip) play();
  }, [selectedClip, play]);
  return null;
}

function RegisterAndPause() {
  const { registerPlayer, selectedClip, play, pause } = useAnimationTransport();
  useEffect(() => registerPlayer(REG), [registerPlayer]);
  useEffect(() => {
    if (selectedClip) {
      play();
      pause();
    }
  }, [selectedClip, play, pause]);
  return null;
}

describe('BoxHelper playback gating (WI-213)', () => {
  it('does not recompute the selection box every frame while playState is stopped (default)', async () => {
    const updateSpy = vi.spyOn(WorldBoxHelper.prototype, 'update');
    const renderer = await mountGated();

    const callsAfterMount = updateSpy.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0); // the constructor's own call

    // Advance several ticks; the per-frame recompute must stay disabled
    // while nothing is playing — call count must NOT grow.
    await renderer.advanceFrames(5, 0.1);
    expect(updateSpy.mock.calls.length).toBe(callsAfterMount);

    updateSpy.mockRestore();
  });

  it('recomputes every frame while playState is playing', async () => {
    const updateSpy = vi.spyOn(WorldBoxHelper.prototype, 'update');
    const renderer = await mountGated(<RegisterAndPlay />);

    const callsAfterMount = updateSpy.mock.calls.length;
    await renderer.advanceFrames(4, 0.1);
    expect(updateSpy.mock.calls.length).toBe(callsAfterMount + 4);

    updateSpy.mockRestore();
  });

  it('recomputes every frame while playState is paused (a paused scrub still moves the target)', async () => {
    const updateSpy = vi.spyOn(WorldBoxHelper.prototype, 'update');
    const renderer = await mountGated(<RegisterAndPause />);

    const callsAfterMount = updateSpy.mock.calls.length;
    await renderer.advanceFrames(4, 0.1);
    expect(updateSpy.mock.calls.length).toBe(callsAfterMount + 4);

    updateSpy.mockRestore();
  });

  it('does NOT recompute every frame once stopped again after playing', async () => {
    const updateSpy = vi.spyOn(WorldBoxHelper.prototype, 'update');

    function StopAfterPlay() {
      const { registerPlayer, selectedClip, play, stop } = useAnimationTransport();
      useEffect(() => registerPlayer(REG), [registerPlayer]);
      useEffect(() => {
        if (selectedClip) {
          play();
          stop();
        }
      }, [selectedClip, play, stop]);
      return null;
    }

    const renderer = await mountGated(<StopAfterPlay />);

    const callsAfterMount = updateSpy.mock.calls.length;
    await renderer.advanceFrames(4, 0.1);
    expect(updateSpy.mock.calls.length).toBe(callsAfterMount);

    updateSpy.mockRestore();
  });

  it('runs exactly ONE grace update after the playing → stopped edge (the restore frame)', async () => {
    // The commit that closes the tick gate lands BEFORE the frame in which
    // the driver's 'stopped' branch restores the authored pose. One grace
    // update on that frame keeps the box aligned with the restored pose;
    // after it, the gate must hold again.
    const updateSpy = vi.spyOn(WorldBoxHelper.prototype, 'update');
    const renderer = await mountGated(<RegisterAndPlay />);
    await renderer.advanceFrames(2, 0.1); // genuinely playing across commits

    await ReactThreeTestRenderer.act(async () => transport.stop());
    const callsAfterStop = updateSpy.mock.calls.length;

    await renderer.advanceFrames(1, 0.1); // the restore frame → one grace update
    expect(updateSpy.mock.calls.length).toBe(callsAfterStop + 1);

    await renderer.advanceFrames(3, 0.1); // gate holds afterwards
    expect(updateSpy.mock.calls.length).toBe(callsAfterStop + 1);

    updateSpy.mockRestore();
  });
});
