/**
 * GLBSceneRoot animation-driver tests — a GLB instance's embedded clips are
 * surfaced through the selection-driven Animation transport (ADR-0012) and
 * driven by a full-object THREE.AnimationMixer rooted on the loaded GLB
 * (the GLB counterpart to AnimationPlayer / ADR-0011).
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GLBSceneRoot } from './Component';
import type { TscnNode } from '../../../parser/types';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
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

const GLB_PATH = 'res://player.glb';
const GLB_NODE_PATH = 'Root/player';

/** A GLB-like object: a Scene group with a movable child, carrying clips. */
function makeAnimatedGlb(): THREE.Object3D {
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
  root.animations = [idle, slide];
  return root;
}

function makeLoader(glb: THREE.Object3D): ResourceLoader {
  const eventBus = new ResourceEventBus();
  const glbCache = new Map<string, THREE.Object3D | null>([[GLB_PATH, glb]]);
  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: vi.fn(),
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: () => {},
    getCacheSize: () => cache.size,
  });
  return {
    eventBus,
    glbMeshes: makeProc<THREE.Object3D>(glbCache),
    register: vi.fn(),
  } as unknown as ResourceLoader;
}

function makeGlbNode(): TscnNode {
  return {
    name: 'player',
    type: 'GLBSceneRoot',
    children: [],
    properties: { glbPath: GLB_PATH } as Record<string, unknown>,
  };
}

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

async function mountScene({ select = GLB_NODE_PATH }: { select?: string | null } = {}) {
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={makeLoader(makeAnimatedGlb())}>
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
  await setSelection(select);
  return renderer;
}

function moverX(renderer: Awaited<ReturnType<typeof mountScene>>): number {
  // Mover lives inside the mounted <primitive> (the cloned GLB), so it is not
  // a fiber node — traverse the real THREE scene by name instead.
  const root = renderer.scene.instance as THREE.Object3D;
  const mover = root.getObjectByName('Mover');
  if (!mover) throw new Error('Mover not found in mounted GLB');
  return mover.position.x;
}

describe('GLBSceneRoot animation driver — transport registration', () => {
  it('registers its GLB-embedded clips only when it is the selected node', async () => {
    const renderer = await mountScene({ select: null });
    expect(transport.clips).toEqual([]); // not selected -> not registered

    await setSelection(GLB_NODE_PATH);
    expect(transport.clips).toEqual(['idle', 'slide']); // selected -> registered

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
    // The mixer is torn down on deselect (it is gated on selection), so the
    // effect cleanup — not the playback loop — must restore the authored pose.
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
