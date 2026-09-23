/**
 * AnimationPlayer degraded paths: what the linter warns on (a missing library SubResource, an empty
 * library, an unresolvable root_node) still mounts without throwing, passes its children through,
 * and applies no transform while playing. The scaffold mirrors Component.playback.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationPlayer } from './Component';
import { resolveAnimations } from './animationResolver';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../../r3f/contexts/AnimationTransportContext';
import { SelectionProvider, useOptionalSelection, type SelectionContextValue } from '../../../r3f/contexts/SelectionContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { AnimationPlayerProperties } from './types';
import { AnimationProcessMode, MethodCallMode } from './types';

// A single resolvable "slide" clip moving Target from x=0 to x=10 over 1s. It
// is what proves a real animation is skipped when root_node cannot resolve.
const RESOLVABLE_INTERNAL: TscnInternalResource[] = [
  { id: 'Lib', type: 'AnimationLibrary', data: { _data: '{\n"slide": SubResource("A")\n}' } },
  {
    id: 'A',
    type: 'Animation',
    data: {
      length: '1.0',
      'tracks/0/type': '"value"',
      'tracks/0/path': 'NodePath("Target:position")',
      'tracks/0/keys':
        '{\n"times": PackedFloat32Array(0, 1),\n"values": [Vector3(0, 0, 0), Vector3(10, 0, 0)]\n}',
    },
  },
];

function makeAP(overrides: Partial<AnimationPlayerProperties> = {}): TscnNode {
  const props: AnimationPlayerProperties = {
    name: 'AnimationPlayer',
    speed_scale: 1.0,
    playback_default_blend_time: 0.0,
    callback_mode_process: AnimationProcessMode.IDLE,
    callback_mode_method: MethodCallMode.DEFERRED,
    active: true,
    autoplay: '',
    current_animation: '',
    current_animation_length: 0.0,
    current_animation_position: 0.0,
    root_node: 'NodePath("..")',
    libraries: [],
    ...overrides,
  };
  return { name: props.name ?? 'AnimationPlayer', type: 'AnimationPlayer', children: [], properties: props };
}

const AP_PATH = 'Root/AnimationPlayer';

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

async function mountScene(
  apProps: Partial<AnimationPlayerProperties> = {},
  internal: TscnInternalResource[] = []
) {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internal}>
      <SelectionProvider>
        <AnimationTransportProvider>
          <Capture />
          <group name="Root">
            <NodePathProvider path={AP_PATH}>
              <AnimationPlayer node={makeAP(apProps)} />
            </NodePathProvider>
            <mesh name="Target">
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial />
            </mesh>
          </group>
        </AnimationTransportProvider>
      </SelectionProvider>
    </SceneResourcesProvider>
  );
  await setSelection(AP_PATH);
  return renderer;
}

function targetX(renderer: Awaited<ReturnType<typeof mountScene>>): number {
  return renderer.scene.findByProps({ name: 'Target' }).instance.position.x;
}

describe('AnimationPlayer degraded paths', () => {
  it('missing library SubResource: mounts, children pass through, resolves to zero animations', async () => {
    const libraries = [{ name: '', subResourceId: 'AnimationLibrary_ghost' }];
    // AnimationLibrary_ghost is never declared in internalResources.
    const renderer = await mountScene({ libraries }, []);
    expect(renderer.scene.findByProps({ name: 'Target' })).toBeDefined();
    // The same pure function the Component uses to build `animations`: the
    // dangling SubResource id resolves to nothing.
    expect(resolveAnimations(libraries, [])).toEqual([]);
    expect(transport.clips).toEqual([]); // nothing registered to play
  });

  it('empty libraries=[]: mounts, no animations, children render', async () => {
    const renderer = await mountScene({ libraries: [] }, []);
    expect(renderer.scene.findByProps({ name: 'Target' })).toBeDefined();
    expect(transport.clips).toEqual([]);
  });

  it('invalid root_node NodePath: mounts and tracks are skipped gracefully (no crash, no drive)', async () => {
    // Climb past the real tree (Root has no further named ancestor) so
    // resolveAnimationRoot returns null, and the mixer-build effect bails out
    // before ever creating a THREE.AnimationMixer.
    const renderer = await mountScene(
      { root_node: 'NodePath("../..")', autoplay: 'slide' },
      RESOLVABLE_INTERNAL
    );
    expect(renderer.scene.findByProps({ name: 'Target' })).toBeDefined();

    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(2, 0.5);
    // No mixer was built, so the target keeps its authored position.
    expect(targetX(renderer)).toBeCloseTo(0);
  });
});
