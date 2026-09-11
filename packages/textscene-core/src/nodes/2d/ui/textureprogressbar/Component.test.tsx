/**
 * `<TextureProgressBar>` — pins that the painter WIRES up `texture_under`,
 * `texture_progress`, `texture_over` in that order (`texture_progress_bar.cpp:
 * 439-482`), and dispatches to the right geometry SHAPE per
 * `fill_mode`/`nine_patch_stretch`. Exact numbers for each shape are proved
 * once in `linearFill.test.ts`/`ninePatchProgress.test.ts`/`radialFill.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { TextureProgressBar } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { TextureProgressBarProperties } from './types';

const UNDER = 'res://under.png';
const PROGRESS = 'res://progress.png';
const OVER = 'res://over.png';

function fakeTexture(w: number, h: number): THREE.Texture {
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: w, height: h };
  return tex;
}

const SCOPE = {
  externalResources: [
    { id: '1', type: 'Texture2D', path: UNDER },
    { id: '2', type: 'Texture2D', path: PROGRESS },
    { id: '3', type: 'Texture2D', path: OVER },
  ],
  internalResources: [],
};

function node(properties: Partial<TextureProgressBarProperties>): TscnNode {
  return {
    name: 'Bar',
    type: 'TextureProgressBar',
    children: [],
    properties: { name: 'Bar', ...properties } as TextureProgressBarProperties,
  };
}

function solveNode(n: TscnNode): SolveNode {
  return { ...emptySolveNode(), path: n.name, node: n, resources: SCOPE };
}

const RECT: Rect2 = { x: 0, y: 0, w: 64, h: 16 };

async function render(
  properties: Partial<TextureProgressBarProperties>,
  tint?: NativeControlComponentProps['tint'],
  rect: Rect2 = RECT
) {
  const fake = createFakeResourceLoader();
  fake.textures.seed(UNDER, fakeTexture(64, 16));
  fake.textures.seed(PROGRESS, fakeTexture(64, 16));
  fake.textures.seed(OVER, fakeTexture(64, 16));

  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={SCOPE.externalResources}>
        <TextureProgressBar
          {...painterEnv()}
          {...(tint ? { tint } : {})}
          solveNode={solveNode(node(properties))}
          rect={rect}
          renderOrder={0}
        />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<TextureProgressBar>', () => {
  it('draws all three layers, linear fill_mode, ratio > 0', async () => {
    const renderer = await render({
      textureUnder: 'ExtResource("1")',
      textureProgress: 'ExtResource("2")',
      textureOver: 'ExtResource("3")',
      fillMode: 0,
      value: 50,
    });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(3);
  });

  it('draws only the layers with a texture reference', async () => {
    const renderer = await render({ textureProgress: 'ExtResource("2")', fillMode: 0, value: 50 });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws under/over as a nine-patch mesh (still one Mesh each) when nine_patch_stretch is set', async () => {
    const renderer = await render({
      textureUnder: 'ExtResource("1")',
      textureOver: 'ExtResource("3")',
      ninePatchStretch: true,
      stretchMarginLeft: 4,
      stretchMarginTop: 4,
      stretchMarginRight: 4,
      stretchMarginBottom: 4,
    });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it('draws the progress layer as a radial fan for FILL_CLOCKWISE at a partial ratio', async () => {
    const renderer = await render({ textureProgress: 'ExtResource("2")', fillMode: 4, value: 25 });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws the progress layer as a full quad for FILL_CLOCKWISE at ratio 1 (full circle)', async () => {
    const renderer = await render({ textureProgress: 'ExtResource("2")', fillMode: 4, value: 100 });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws nothing for the progress layer for FILL_CLOCKWISE at ratio 0', async () => {
    const renderer = await render({ textureProgress: 'ExtResource("2")', fillMode: 4, value: 0 });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('forwards renderOrder to every mesh it draws', async () => {
    const renderer = await render({
      textureUnder: 'ExtResource("1")',
      textureProgress: 'ExtResource("2")',
      textureOver: 'ExtResource("3")',
      fillMode: 0,
      value: 50,
    });
    for (const mesh of renderer.scene.findAllByType('Mesh')) {
      expect(mesh.instance.renderOrder).toBe(0);
    }
  });

  it('composes tint_under onto the walker tint, in linear space, for the under layer', async () => {
    const untinted = await render({ textureUnder: 'ExtResource("1")' });
    const tinted = await render(
      { textureUnder: 'ExtResource("1")', tintUnder: { r: 0.5, g: 0.2, b: 0.2, a: 1 } },
      painterTint({ r: 1, g: 1, b: 1, a: 1 })
    );
    const colorOf = (r: typeof untinted) =>
      (r.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(colorOf(untinted).color.r).toBeCloseTo(1, 6);
    expect(colorOf(tinted).color.g).toBeLessThan(colorOf(untinted).color.g);
  });
});
