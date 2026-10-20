/**
 * A GLB instance's embedded clips reach the selection-driven Animation transport (ADR-0012) and
 * play through a THREE.AnimationMixer rooted on the loaded GLB, the counterpart of
 * AnimationPlayer (ADR-0011).
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GLBSceneRoot } from './Component';
import type { TscnNode } from '../../../parser/types';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../contexts/AnimationTransportContext';
import {
  SelectionProvider,
  useOptionalSelection,
  type SelectionContextValue,
} from '../../contexts/SelectionContext';
import { NodePathProvider } from '../../contexts/NodePathContext';
import { AnimationLoopMode } from '../../../godot/scene/animation';
import { setImportedLoopMode } from '../../../resources/formats/glb/importedLoopMode';

const GLB_PATH = 'res://player.glb';
const GLB_NODE_PATH = 'Root/player';
// As in Godot, clips surface on an AnimationPlayer child, so selecting this path, not the GLB
// root, activates the driver.
const GLB_ANIM_PATH = 'Root/player/AnimationPlayer';

/** A GLB-like object: a Scene group with a movable child, carrying clips. 'slide' imports as `slideLoopMode`. */
function makeAnimatedGlb(slideLoopMode: number): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Scene';
  const mover = new THREE.Object3D();
  mover.name = 'Mover';
  root.add(mover);

  // 'slide' moves Mover x 0 -> 10 over 1s; 'idle' is a no-op marker clip.
  const slide = new THREE.AnimationClip('slide', 1, [
    new THREE.VectorKeyframeTrack('Mover.position', [0, 1], [0, 0, 0, 10, 0, 0]),
  ]);
  const idle = new THREE.AnimationClip('idle', 1, [
    new THREE.VectorKeyframeTrack('Mover.position', [0, 1], [0, 0, 0, 0, 0, 0]),
  ]);
  setImportedLoopMode(slide, slideLoopMode);
  root.animations = [idle, slide];
  return root;
}

function makeLoader(glb: THREE.Object3D): ResourceLoader {
  const fake = createFakeResourceLoader();
  fake.glbMeshes.seed(GLB_PATH, glb);
  return fake.loader;
}

function makeGlbNode(): TscnNode {
  return {
    rawProperties: {},
    name: 'player',
    type: 'GLBSceneRoot',
    children: [],
    properties: { glbPath: GLB_PATH } as Record<string, unknown>,
  };
}

// Every mounted root is torn down after its test. A root left alive can still re-render its
// Capture after the next test mounts, pointing `transport` at the stale scene.
const mounted: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>[] = [];
afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

let transport: AnimationTransport;
let selection: SelectionContextValue | null;
function Capture() {
  transport = useAnimationTransport();
  selection = useOptionalSelection();
  return null;
}

async function setSelection(path: string | null) {
  await ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath(path));
}

async function mountScene({
  select = GLB_ANIM_PATH,
  slideLoopMode = AnimationLoopMode.LINEAR,
}: { select?: string | null; slideLoopMode?: number } = {}) {
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={makeLoader(makeAnimatedGlb(slideLoopMode))}>
      <SelectionProvider>
        <AnimationTransportProvider>
          <Capture />
          <group name="Root">
            <NodePathProvider path={GLB_NODE_PATH}>
              <GLBSceneRoot node={makeGlbNode()} />
            </NodePathProvider>
          </group>
        </AnimationTransportProvider>
      </SelectionProvider>
    </ResourceLoaderProvider>
  );
  mounted.push(renderer);
  await setSelection(select);
  return renderer;
}

function moverX(renderer: Awaited<ReturnType<typeof mountScene>>): number {
  // Mover lives inside the mounted <primitive>, the cloned GLB, so it is no fiber node: traverse
  // the THREE scene by name.
  const root = renderer.scene.instance as THREE.Object3D;
  const mover = root.getObjectByName('Mover');
  if (!mover) throw new Error('Mover not found in mounted GLB');
  return mover.position.x;
}

describe('GLBSceneRoot animation driver — transport registration', () => {
  it('registers its GLB-embedded clips only when its AnimationPlayer node is selected', async () => {
    const renderer = await mountScene({ select: null });
    expect(transport.clips).toEqual([]); // not selected -> not registered

    await setSelection(GLB_NODE_PATH);
    expect(transport.clips).toEqual([]); // the GLB root does not drive the tab

    await setSelection(GLB_ANIM_PATH);
    expect(transport.clips).toEqual(['idle', 'slide']); // the AnimationPlayer node does

    await renderer.unmount();
  });

  it('shows the Animation tab (hasPlayer) once selected', async () => {
    const renderer = await mountScene();
    expect(transport.hasPlayer).toBe(true);
    await renderer.unmount();
  });
});

describe('GLBSceneRoot animation driver — playback', () => {
  it('applies nothing while stopped — the GLB keeps its authored pose', async () => {
    const renderer = await mountScene();
    await renderer.advanceFrames(2, 0.5);
    expect(moverX(renderer)).toBeCloseTo(0);
  });

  it('drives the GLB while playing the selected clip', async () => {
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5); // t=0.5 -> x=5
    expect(moverX(renderer)).toBeCloseTo(5, 1);
  });

  it('restores the authored pose on stop', async () => {
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5);
    expect(moverX(renderer)).toBeGreaterThan(1);
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await renderer.advanceFrames(1, 0);
    expect(moverX(renderer)).toBeCloseTo(0);
  });

  it('restores the authored pose when it loses selection mid-playback', async () => {
    // Deselect removes the mixer, so the effect cleanup, not the playback loop, must restore the
    // authored pose.
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5);
    expect(moverX(renderer)).toBeGreaterThan(1);
    await setSelection('Root/SomethingElse'); // deselect the GLB driver
    await renderer.advanceFrames(1, 0);
    expect(moverX(renderer)).toBeCloseTo(0);
  });
});

describe('GLBSceneRoot animation driver — preview speed + loop override (#224)', () => {
  it('scales the advance rate by the preview playbackSpeed multiplier', async () => {
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.setPlaybackSpeed(2));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.25); // 0.25 * 2 = 0.5 -> x=5
    expect(moverX(renderer)).toBeCloseTo(5, 1);
  });

  it('loops a LOOP_LINEAR clip forever under "auto", wrapping around past the clip length', async () => {
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 1.5); // 1.5 mod 1.0 = 0.5 -> x=5, not clamped at 10
    expect(moverX(renderer)).toBeCloseTo(5, 1);
  });

  it('"once" forces a single clamped pass on a LOOP_LINEAR clip', async () => {
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.setLoopOverride('once'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 1.5); // past the 1s length -> clamped at the final key
    expect(moverX(renderer)).toBeCloseTo(10, 1);
  });

  it('plays a LOOP_NONE clip as one clamped pass under "auto"', async () => {
    const renderer = await mountScene({ slideLoopMode: AnimationLoopMode.NONE });
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 1.5);
    expect(moverX(renderer)).toBeCloseTo(10, 1);
  });

  it('plays a LOOP_PINGPONG clip forwards and then backwards under "auto"', async () => {
    const renderer = await mountScene({ slideLoopMode: AnimationLoopMode.PINGPONG });
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 1.25); // forward 1s, back 0.25s -> t=0.75 -> x=7.5
    expect(moverX(renderer)).toBeCloseTo(7.5, 1);
  });

  it('"loop" repeats a LOOP_NONE clip', async () => {
    const renderer = await mountScene({ slideLoopMode: AnimationLoopMode.NONE });
    await ReactThreeTestRenderer.act(async () => transport.selectClip('slide'));
    await ReactThreeTestRenderer.act(async () => transport.setLoopOverride('loop'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 1.5);
    expect(moverX(renderer)).toBeCloseTo(5, 1);
  });
});
