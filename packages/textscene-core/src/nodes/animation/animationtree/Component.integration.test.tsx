/**
 * End-to-end AnimationTree: parses the `unit-animation-tree-*` fixtures through the TscnParser and
 * mounts them through NodeDispatcher, as production does. AnimationPlayer registers as a driver at
 * its NodePath and AnimationTree resolves `anim_player` to it, so nothing moves unless the
 * `tree_root`, the `anim_player` resolution and the track binding all work.
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { fixturesDir, flatten } from '../../../parser/testing/parserKit';
import type { TscnNode, TscnScene } from '../../../parser/types';
import * as THREE from 'three';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../../r3f/contexts/AnimationTransportContext';
import {
  useOptionalSelection,
  type SelectionContextValue,
} from '../../../r3f/contexts/SelectionContext';
import { AnimationDriverProvider } from '../../../r3f/contexts/AnimationDriverContext';

import '../../../r3f/nodes/index';

function parseFixture(file: string): TscnScene {
  const f = resolve(fixturesDir(), file);
  if (!existsSync(f)) throw new Error(`fixture missing: scenes/fixtures/${file}`);
  return new TscnParser().parse(readFileSync(f, 'utf8'));
}

function findByType(scene: TscnScene, type: string): TscnNode {
  const found = flatten(scene).find((n) => n.type === type);
  if (!found) throw new Error(`no ${type} node in fixture`);
  return found;
}

const AT_PATH = 'Scene/AnimationTree';

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

/** Mounts the parsed fixture through the dispatcher, as production does. */
async function mountFixture(file: string, { select = AT_PATH }: { select?: string | null } = {}) {
  const scene = parseFixture(file);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="3d" loader={createFakeResourceLoader().loader} scene={scene}>
      <AnimationTransportProvider>
        <AnimationDriverProvider>
          <Capture />
          <NodeDispatcher nodes={scene.nodes} />
        </AnimationDriverProvider>
      </AnimationTransportProvider>
    </SceneStack>
  );
  await setSelection(select);
  return renderer;
}

/** The Mesh node's own group: the first object named after it. */
function meshY(renderer: Awaited<ReturnType<typeof mountFixture>>): number {
  let root = (renderer.scene as unknown as { children: Array<{ instance: THREE.Object3D }> }).children[0]!.instance;
  while (root.parent) root = root.parent;
  const mesh = root.getObjectByName('Mesh');
  if (!mesh) throw new Error('the Mesh node mounted nothing');
  return mesh.position.y;
}

describe('AnimationTree integration — unit-animation-tree-state-machine.tscn', () => {
  it('parses with active=true, a StateMachine tree_root, and an idle/walk AnimationLibrary', () => {
    const scene = parseFixture('unit-animation-tree-state-machine.tscn');
    const treeNode = findByType(scene, 'AnimationTree');
    const props = treeNode.properties as { active: boolean; tree_root?: string; anim_player: string };
    expect(props.active).toBe(true);
    expect(props.tree_root).toMatch(/^SubResource\("/);
    expect(props.anim_player).toBe('NodePath("../AnimationPlayer")');
    expect(scene.internalResources.map((r) => r.type)).toContain('AnimationNodeStateMachine');
    expect(scene.internalResources.map((r) => r.type)).toContain('AnimationLibrary');
  });

  it('resolves anim_player + tree_root end-to-end: playing drives the Mesh through the idle state', async () => {
    const renderer = await mountFixture('unit-animation-tree-state-machine.tscn');
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.25); // idle: y goes 0.5 -> 0.7 -> 0.5 over 1s
    expect(meshY(renderer)).toBeGreaterThan(0.5);
    await renderer.unmount();
  });

  it('registers a transport entry only while selected (active-gated, like AnimationPlayer)', async () => {
    const renderer = await mountFixture('unit-animation-tree-state-machine.tscn', { select: null });
    expect(transport.hasPlayer).toBe(false);
    await setSelection(AT_PATH);
    expect(transport.hasPlayer).toBe(true);
    await renderer.unmount();
  });
});

describe('AnimationTree integration — unit-animation-tree-stateless.tscn', () => {
  it('parses with active=false', () => {
    const scene = parseFixture('unit-animation-tree-stateless.tscn');
    const treeNode = findByType(scene, 'AnimationTree');
    expect((treeNode.properties as { active: boolean }).active).toBe(false);
  });

  it('mounts without crashing and drives nothing even while selected and played', async () => {
    const renderer = await mountFixture('unit-animation-tree-stateless.tscn');
    const before = meshY(renderer);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(2, 0.5);
    expect(meshY(renderer)).toBeCloseTo(before);
    await renderer.unmount();
  });

  it('never registers a transport entry, even when selected', async () => {
    const renderer = await mountFixture('unit-animation-tree-stateless.tscn');
    expect(transport.hasPlayer).toBe(false);
    await renderer.unmount();
  });
});
