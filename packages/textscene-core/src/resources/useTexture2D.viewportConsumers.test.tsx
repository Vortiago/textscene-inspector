/**
 * Node types that read a Texture2D slot, given a ViewportTexture. Each draws the SubViewport's live
 * target, which every reader shares, so none clones it into a frozen copy or disposes it. Godot
 * 4.6.3 draws a ViewportTexture in a TextureRect (`scenes/fixtures/unit-texture-rect-viewport-texture.tscn`).
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
import '../nodes/3d/sprite3d/index.r3f';
import { registeredComponent } from '../r3f/testing/registeredComponent';

const Sprite3D = registeredComponent('Sprite3D');

const RESOURCES: TscnInternalResource[] = [
  { id: 'ViewportTexture_1', type: 'ViewportTexture', data: { viewport_path: 'NodePath("SubViewport")' } },
];

const VIEWPORT_REF = 'SubResource("ViewportTexture_1")';
const RECT: Rect2 = { x: 0, y: 0, w: 320, h: 160 };

const target = createCanvasTarget(32, 32, 'SubViewport');
const decodingTarget = createCanvasTarget(32, 32, 'SubViewport decoding view');
afterEach(() => target.texture.removeEventListener('dispose', countDispose));

let disposals = 0;
function countDispose() {
  disposals++;
}

function provide(children: ReactNode, workspace?: '2d') {
  disposals = 0;
  target.texture.addEventListener('dispose', countDispose);
  return ReactThreeTestRenderer.create(
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

function textureRect(): ReactNode {
  const n = node('TextureRect', parseTextureRect(heading('TextureRect'), { texture: VIEWPORT_REF }));
  const solveNode = {
    ...emptySolveNode(),
    path: 'N',
    node: n,
    resources: { internalResources: RESOURCES, externalResources: [] },
  };
  return <TextureRect {...painterEnv()} solveNode={solveNode} rect={RECT} renderOrder={0} />;
}

describe('a ViewportTexture reaches every Texture2D slot', () => {
  it('TextureRect draws the live target', async () => {
    const renderer = await provide(textureRect(), '2d');
    expect(mapsIn(renderer)).toEqual([target.texture]);
  });

  it('TextureRect leaves the shared target undisposed once it unmounts', async () => {
    const renderer = await provide(textureRect(), '2d');
    await renderer.unmount();
    expect(disposals).toBe(0);
  });

  it('Sprite2D draws the live target and leaves it undisposed once it unmounts', async () => {
    const sprite = node('Sprite2D', parseSprite2D(heading('Sprite2D'), { texture: VIEWPORT_REF }));
    const renderer = await provide(<Sprite2D node={sprite} />, '2d');
    expect(mapsIn(renderer)).toEqual([target.texture]);
    await renderer.unmount();
    expect(disposals).toBe(0);
  });

  it("Sprite3D draws the target's decoding view, as its `source_color` albedo samples it", async () => {
    const sprite = node('Sprite3D', parseSprite3D(heading('Sprite3D'), { texture: VIEWPORT_REF }));
    const renderer = await provide(<Sprite3D node={sprite} />);
    expect(mapsIn(renderer)).toContain(decodingTarget.texture);
  });
});
