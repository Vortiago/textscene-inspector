/**
 * `<TextureButton>` render contract. Rig mirrors `texturerect/Component.test.tsx`
 * (`createFakeResourceLoader` + `ResourceLoaderProvider` +
 * `SceneResourcesProvider`, since `useResource` needs a live provider to ever
 * leave `pending`) — three distinctly-SIZED fake textures (normal/pressed/
 * disabled) so which one got selected is provable from the drawn mesh's own
 * geometry (STRETCH_KEEP, the Godot default, draws at natural texture size).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { TextureButton } from './Component';
import type { TextureButtonProperties } from './types';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const RECT: Rect2 = { x: 0, y: 0, w: 100, h: 100 };
const NORMAL_TEX = 'res://normal.png';
const PRESSED_TEX = 'res://pressed.png';
const DISABLED_TEX = 'res://disabled.png';

const SCOPE = {
  externalResources: [
    { id: '1', type: 'Texture2D', path: NORMAL_TEX },
    { id: '2', type: 'Texture2D', path: PRESSED_TEX },
    { id: '3', type: 'Texture2D', path: DISABLED_TEX },
  ],
  internalResources: [],
};

function fakeTexture(width: number, height: number): THREE.Texture {
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width, height };
  return tex;
}

function solveNode(properties: Partial<TextureButtonProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyTextureButton',
    type: 'TextureButton',
    children: [],
    properties: {
      name: 'MyTextureButton',
      textureNormal: 'ExtResource("1")',
      texturePressed: 'ExtResource("2")',
      textureDisabled: 'ExtResource("3")',
      ...properties,
    } as TextureButtonProperties,
  };
  return { ...emptySolveNode(), path: 'MyTextureButton', node, resources: SCOPE };
}

interface RenderOptions {
  tint?: ReturnType<typeof painterTint>;
}

async function render(properties: Partial<TextureButtonProperties> = {}, options: RenderOptions = {}) {
  const fake = createFakeResourceLoader();
  fake.textures.seed(NORMAL_TEX, fakeTexture(20, 20));
  fake.textures.seed(PRESSED_TEX, fakeTexture(40, 40));
  fake.textures.seed(DISABLED_TEX, fakeTexture(60, 60));

  const tree = (
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={SCOPE.externalResources}>
        <TextureButton
          {...painterEnv()}
          {...(options.tint ? { tint: options.tint } : {})}
          solveNode={solveNode(properties)}
          rect={RECT}
          renderOrder={0}
        />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return ReactThreeTestRenderer.create(tree);
}

function findQuad(scene: Awaited<ReturnType<typeof render>>['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
}

describe('<TextureButton> (isolated painter contract)', () => {
  it('draws nothing before any texture resolves', async () => {
    const fake = createFakeResourceLoader();
    // No seed — texture stays pending.
    const tree = (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={SCOPE.externalResources}>
          <TextureButton {...painterEnv()} solveNode={solveNode()} rect={RECT} renderOrder={0} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(tree);
    expect(findQuad(renderer.scene)).toBeUndefined();
  });

  it('draws texture_normal at its natural size (STRETCH_KEEP, the Godot default) in the normal state', async () => {
    const renderer = await render();
    const mesh = findQuad(renderer.scene)!;
    const geom = mesh.geometry as unknown as { parameters: { width: number; height: number } };
    expect(geom.parameters.width).toBe(20);
    expect(geom.parameters.height).toBe(20);
  });

  it('draws texture_pressed when pressed', async () => {
    const renderer = await render({ buttonPressed: true });
    const mesh = findQuad(renderer.scene)!;
    const geom = mesh.geometry as unknown as { parameters: { width: number; height: number } };
    expect(geom.parameters.width).toBe(40);
  });

  it('draws texture_disabled when disabled (wins over pressed)', async () => {
    const renderer = await render({ buttonPressed: true, disabled: true });
    const mesh = findQuad(renderer.scene)!;
    const geom = mesh.geometry as unknown as { parameters: { width: number; height: number } };
    expect(geom.parameters.width).toBe(60);
  });

  it('falls back to texture_normal when pressed but texture_pressed is unset', async () => {
    const renderer = await render({ buttonPressed: true, texturePressed: undefined });
    const mesh = findQuad(renderer.scene)!;
    const geom = mesh.geometry as unknown as { parameters: { width: number; height: number } };
    expect(geom.parameters.width).toBe(20);
  });

  it('STRETCH_SCALE (0) fills the control rect regardless of natural texture size', async () => {
    const renderer = await render({ stretchMode: 0 });
    const mesh = findQuad(renderer.scene)!;
    const geom = mesh.geometry as unknown as { parameters: { width: number; height: number } };
    expect(geom.parameters.width).toBe(100);
    expect(geom.parameters.height).toBe(100);
  });

  it('applies the walker-composed tint to the drawn quad', async () => {
    const renderer = await render({}, { tint: painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 }) });
    const mesh = findQuad(renderer.scene)!;
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(1, 5);
    expect(material.color.r).toBeLessThan(1);
  });

  it('forwards renderOrder to the drawn mesh', async () => {
    const fake = createFakeResourceLoader();
    fake.textures.seed(NORMAL_TEX, fakeTexture(20, 20));
    const tree = (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={SCOPE.externalResources}>
          <TextureButton {...painterEnv()} solveNode={solveNode()} rect={RECT} renderOrder={9} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(tree);
    const mesh = findQuad(renderer.scene)!;
    expect(mesh.renderOrder).toBe(9);
  });
});
