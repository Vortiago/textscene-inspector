/**
 * Node types that read a Texture2D slot, given a ViewportTexture. Each draws its own copy of the
 * SubViewport's live target, which the pass refills after each render, through its own sampler, and
 * none disposes the shared target. Godot 4.6.3 draws a ViewportTexture in a TextureRect
 * (`scenes/fixtures/unit-texture-rect-viewport-texture.tscn`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource, TscnNode } from '../parser/types';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { painterEnv } from '../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../r3f/controls/native/testing/solveNode';
import type { Rect2 } from '../godot/math/rect2';
import { NodePathProvider } from '../r3f/contexts/NodePathContext';
import { ViewportTextureProvider } from '../r3f/contexts/ViewportTextureContext';
import { ViewportTexturePublisher, viewportEntry } from '../r3f/testing/ViewportTexturePublisher';
import { createCanvasTarget } from '../nodes/viewport/subviewport/offscreenViewport';
import { TextureRect } from '../nodes/2d/ui/texturerect/Component';
import { parseTextureRect } from '../nodes/2d/ui/texturerect/parser';
import { Sprite2D } from '../nodes/2d/sprite2d/Component';
import { parseSprite2D } from '../nodes/2d/sprite2d/parser';
import { parseSprite3D } from '../nodes/3d/sprite3d/parser';
import { SceneStack } from '../r3f/testing/SceneStack';
import { ControlCanvasWalker } from '../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../r3f/controls/native/nativeTheme';
import { controlNode } from '../r3f/controls/native/testing/solveNode';
import '../nodes/3d/sprite3d/index.r3f';
import { registeredComponent } from '../r3f/testing/registeredComponent';
import { copiesFilledFrom } from '../r3f/liveTargets.testkit';

const Sprite3D = registeredComponent('Sprite3D');

const RESOURCES: TscnInternalResource[] = [
  { id: 'ViewportTexture_1', type: 'ViewportTexture', data: { viewport_path: 'NodePath("SubViewport")' } },
];

const VIEWPORT_REF = 'SubResource("ViewportTexture_1")';
const RECT: Rect2 = { x: 0, y: 0, w: 320, h: 160 };

const target = createCanvasTarget(32, 32, 'SubViewport');
const decodingTarget = createCanvasTarget(32, 32, 'SubViewport decoding view');
/** Every renderer a test mounts, unmounted after it, so no test sees another's copies. */
let mounted: { unmount: () => Promise<void> }[] = [];
afterEach(async () => {
  target.texture.removeEventListener('dispose', countDispose);
  await Promise.all(mounted.map((renderer) => renderer.unmount()));
  mounted = [];
});

let disposals = 0;
function countDispose() {
  disposals++;
}

async function provide(children: ReactNode, workspace?: '2d') {
  disposals = 0;
  target.texture.addEventListener('dispose', countDispose);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack
      workspace={workspace}
      loader={createFakeResourceLoader().loader}
      scene={{ internalResources: RESOURCES }}
    >
      <ViewportTextureProvider>
        <ViewportTexturePublisher path="Root/SubViewport" entry={ENTRY} />
        <NodePathProvider path="Root/N">{children}</NodePathProvider>
      </ViewportTextureProvider>
    </SceneStack>
  );
  mounted.push(renderer);
  return renderer;
}

const ENTRY = viewportEntry(
  target.texture,
  { x: 32, y: 32 },
  {
    decoding: { texture: decodingTarget.texture, retain: () => () => {} },
  }
);

function node(type: string, properties: TscnNode['properties']): TscnNode {
  return { rawProperties: {}, name: 'N', type, children: [], properties };
}

const heading = (type: string) => ({ type: 'node', attributes: { type, name: 'N' } });

/** Every `map` bound anywhere in the rendered subtree. */
function mapsIn(renderer: Awaited<ReturnType<typeof provide>>): THREE.Texture[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => ((m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined)?.map)
    .filter((t): t is THREE.Texture => Boolean(t));
}

function textureRect(properties: Record<string, string> = {}): ReactNode {
  const n = node(
    'TextureRect',
    parseTextureRect(heading('TextureRect'), { texture: VIEWPORT_REF, ...properties })
  );
  const solveNode = {
    ...emptySolveNode(),
    path: 'N',
    node: n,
    resources: { internalResources: RESOURCES, externalResources: [] },
  };
  return <TextureRect {...painterEnv()} solveNode={solveNode} rect={RECT} renderOrder={0} />;
}

describe('a ViewportTexture reaches every Texture2D slot', () => {
  it("TextureRect draws the live target itself when it samples the target's own state", async () => {
    const renderer = await provide(textureRect(), '2d');
    expect([mapsIn(renderer), copiesFilledFrom(target.texture)]).toEqual([[target.texture], []]);
  });

  it('TextureRect mirrors its copy for flip_h, and leaves the shared target unmirrored', async () => {
    const renderer = await provide(textureRect({ flip_h: 'true' }), '2d');
    const [copy] = mapsIn(renderer);
    expect([copy!.repeat.x, target.texture.repeat.x]).toEqual([-1, 1]);
  });

  it('TextureRect frees its copy and leaves the shared target undisposed once it unmounts', async () => {
    const renderer = await provide(textureRect({ flip_h: 'true' }), '2d');
    await renderer.unmount();
    expect([disposals, copiesFilledFrom(target.texture)]).toEqual([0, []]);
  });

  it('Sprite2D draws the live target itself and leaves it undisposed once it unmounts', async () => {
    const sprite = node('Sprite2D', parseSprite2D(heading('Sprite2D'), { texture: VIEWPORT_REF }));
    const renderer = await provide(<Sprite2D node={sprite} />, '2d');
    expect(mapsIn(renderer)).toEqual([target.texture]);
    await renderer.unmount();
    expect(disposals).toBe(0);
  });

  it('Sprite2D samples its copy through its region', async () => {
    const sprite = node(
      'Sprite2D',
      parseSprite2D(heading('Sprite2D'), {
        texture: VIEWPORT_REF,
        region_enabled: 'true',
        region_rect: 'Rect2(0, 0, 16, 32)',
      })
    );
    const renderer = await provide(<Sprite2D node={sprite} />, '2d');
    expect(mapsIn(renderer)[0]!.repeat.x).toBe(0.5);
  });

  it("Sprite3D draws its own copy of the target's decoding view, as its `source_color` albedo samples it", async () => {
    const sprite = node('Sprite3D', parseSprite3D(heading('Sprite3D'), { texture: VIEWPORT_REF }));
    const renderer = await provide(<Sprite3D node={sprite} />);
    expect(mapsIn(renderer)).toEqual(expect.arrayContaining(copiesFilledFrom(decodingTarget.texture)));
  });

  it('Sprite3D mirrors its copy for flip_h', async () => {
    const sprite = node(
      'Sprite3D',
      parseSprite3D(heading('Sprite3D'), { texture: VIEWPORT_REF, flip_h: 'true' })
    );
    const renderer = await provide(<Sprite3D node={sprite} />);
    expect(mapsIn(renderer).map((map) => map.repeat.x)).toContain(-1);
  });

  it('TextureRect draws the live target when the Control walker paints it', async () => {
    controlComponentRegistry.register({ typeName: 'TextureRect', Component: TextureRect });
    controlSolverRegistry.clear();
    const n = controlNode('TextureRect', 'TextureRect', {
      ...parseTextureRect(heading('TextureRect'), { texture: VIEWPORT_REF }),
      offsetRight: 64,
      offsetBottom: 64,
    });
    const root = {
      ...emptySolveNode(),
      path: 'Root/TextureRect',
      node: n,
      resources: { internalResources: RESOURCES, externalResources: [] },
    };
    const viewport = { x: 0, y: 0, w: 1152, h: 648 };
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack
        workspace="2d"
        loader={createFakeResourceLoader().loader}
        scene={{ internalResources: RESOURCES }}
      >
        <ViewportTextureProvider>
          <ViewportTexturePublisher path="Root/SubViewport" entry={ENTRY} />
          <ControlCanvasWalker
            tree={[root]}
            generation={0}
            viewport={viewport}
            theme={nativeTheme(1)}
            measurer={null}
          />
        </ViewportTextureProvider>
      </SceneStack>
    );
    mounted.push(renderer);
    expect(mapsIn(renderer)).toEqual([target.texture]);
    controlComponentRegistry.clear();
  });
});
