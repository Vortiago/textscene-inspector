/**
 * End-to-end AnimationTree integration: parses the real `unit-animation-tree-*`
 * fixtures via the actual TscnParser (not hand-typed property objects — the
 * gap `Component.playback.test.tsx`/`Component.test.tsx` don't close) and
 * mounts BOTH the AnimationPlayer and AnimationTree components together,
 * wired exactly as production does: AnimationPlayer registers itself as a
 * driver at its own NodePath; AnimationTree resolves `anim_player` to that
 * same path and drives it. Proves tree_root resource resolution AND
 * anim_player NodePath resolution together — if either failed, nothing
 * would move.
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { fixturesDir } from '../../../parser/testing/parserKit';
import type { TscnNode, TscnScene } from '../../../parser/types';
import { AnimationPlayer } from '../animationplayer/Component';
import { AnimationTree } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../../r3f/contexts/AnimationTransportContext';
import {
  SelectionProvider,
  useOptionalSelection,
  type SelectionContextValue,
} from '../../../r3f/contexts/SelectionContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { AnimationDriverProvider } from '../../../r3f/contexts/AnimationDriverContext';

function parseFixture(file: string): TscnScene {
  const f = resolve(fixturesDir(), file);
  if (!existsSync(f)) throw new Error(`fixture missing: scenes/fixtures/${file}`);
  return new TscnParser().parse(readFileSync(f, 'utf8'));
}

function flatten(scene: TscnScene): TscnNode[] {
  const out: TscnNode[] = [];
  const walk = (n: TscnNode): void => {
    out.push(n);
    n.children.forEach(walk);
  };
  scene.nodes.forEach(walk);
  return out;
}

function findByType(scene: TscnScene, type: string): TscnNode {
  const found = flatten(scene).find((n) => n.type === type);
  if (!found) throw new Error(`no ${type} node in fixture`);
  return found;
}

const AP_PATH = 'Scene/AnimationPlayer';
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

/** Mounts the real parsed AnimationPlayer + AnimationTree wired as production does. */
async function mountFixture(file: string, { select = AT_PATH }: { select?: string | null } = {}) {
  const scene = parseFixture(file);
  const playerNode = findByType(scene, 'AnimationPlayer');
  const treeNode = findByType(scene, 'AnimationTree');

  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <SelectionProvider>
        <AnimationTransportProvider>
          <AnimationDriverProvider>
            <Capture />
            <group name="Scene">
              <NodePathProvider path={AP_PATH}>
                <AnimationPlayer node={playerNode} />
              </NodePathProvider>
              <NodePathProvider path={AT_PATH}>
                <AnimationTree node={treeNode} />
              </NodePathProvider>
              <mesh name="Mesh">
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial />
              </mesh>
            </group>
          </AnimationDriverProvider>
        </AnimationTransportProvider>
      </SelectionProvider>
    </SceneResourcesProvider>
  );
  await setSelection(select);
  return renderer;
}

function meshY(renderer: Awaited<ReturnType<typeof mountFixture>>): number {
  return renderer.scene.findByProps({ name: 'Mesh' }).instance.position.y;
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
