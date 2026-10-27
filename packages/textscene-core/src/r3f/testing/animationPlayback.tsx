/**
 * Test-only: mounts a scene with an AnimationPlayer selected, plays it for half a second, and gives
 * the three scene back, so a test reads where the tracks moved the nodes.
 */

import { afterEach } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from '../NodeDispatcher';
import { SceneStack } from './SceneStack';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../contexts/AnimationTransportContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../parser/TscnParser';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.testkit';
import { HierarchyProvider } from '../contexts/HierarchyContext';

import '../nodes/index';

const mounted: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>[] = [];
afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

let transport: AnimationTransport;
function Capture() {
  transport = useAnimationTransport();
  return null;
}

/** One animation, "move", sliding the node at `trackPath` from x=0 to x=10 over one second. */
export function moveAnimation(trackPath: string): string {
  return `[sub_resource type="Animation" id="Move"]
resource_name = "move"
length = 1.0
tracks/0/type = "value"
tracks/0/path = NodePath("${trackPath}:position")
tracks/0/interp = 1
tracks/0/keys = {
"times": PackedFloat32Array(0, 1),
"transitions": PackedFloat32Array(1, 1),
"update": 0,
"values": [Vector3(0, 0, 0), Vector3(10, 0, 0)]
}

[sub_resource type="AnimationLibrary" id="Lib"]
_data = {
"move": SubResource("Move")
}
`;
}

export const PLAYER_BODY = 'libraries/ = SubResource("Lib")';

/** Mounts `tscn` through the dispatcher with `playerPath` selected, before any resource loads. */
export async function mountWithPlayer(tscn: string, playerPath: string) {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  // The scene graph gives the `%Name` table a track resolves through.
  const renderer = await ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene(parsed), panelId: 'p' }}>
      <SceneStack workspace="3d" loader={fake.loader} scene={parsed} selectedPath={playerPath}>
        <AnimationTransportProvider>
          <Capture />
          <NodeDispatcher nodes={parsed.nodes} />
        </AnimationTransportProvider>
      </SceneStack>
    </HierarchyProvider>
  );
  mounted.push(renderer);
  return { renderer, fake };
}

/** The root of the three scene `renderer` mounted. */
export function sceneRoot(renderer: Awaited<ReturnType<typeof mountWithPlayer>>['renderer']): THREE.Object3D {
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  if (!root) throw new Error('the dispatcher mounted nothing');
  return root;
}

export async function play(): Promise<void> {
  await ReactThreeTestRenderer.act(async () => transport.play());
}

/**
 * Mounts `tscn` with `playerPath` selected, lets `load` finish the loads the scene waits for, each
 * in its own `act`, plays, and runs half a second.
 */
export async function playHalfway(
  tscn: string,
  playerPath: string,
  load: (fake: FakeResourceLoader) => Promise<void> = async () => {}
): Promise<THREE.Object3D> {
  const { renderer, fake } = await mountWithPlayer(tscn, playerPath);
  await load(fake);
  await play();
  await renderer.advanceFrames(1, 0.5);
  return sceneRoot(renderer);
}

/** The named group at `names`, walking one name per level from the scene. */
export function objectAt(root: THREE.Object3D, ...names: string[]): THREE.Object3D {
  let object: THREE.Object3D | undefined = root;
  for (const name of names) object = object?.getObjectByName(name);
  if (!object) throw new Error(`nothing at ${names.join('/')}`);
  return object;
}
