/**
 * A lit canvas whose items draw a CanvasTexture of flat grey maps. A test reads which light list
 * each item registers for: `apart` for a normal-mapped item, `plain` for one without a normal map.
 */
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
} from '../lighting2d/lightPassContext';
import type { ItemPlacement, LitItemRead } from '../lighting2d/itemLightList';
import type { TscnInternalResource, TscnNode } from '../../parser/types';
import { subResource } from '../../testing/subResource';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.testkit';
import { renderDispatched2D } from './DispatchedScene';
import '../nodes/index';

/** `SubResource("CanvasTexture_1")`, the CanvasTexture `canvasTexture` builds. */
export const CANVAS_TEXTURE_REF = 'SubResource("CanvasTexture_1")';

/** The flat grey 8x8 GradientTexture2D every map of the CanvasTexture names. */
export const FLAT_GREY_REF = 'SubResource("GradientTexture2D_grey")';

const FLAT_GREY: readonly TscnInternalResource[] = [
  subResource('Gradient', 'Gradient_grey', { colors: 'PackedColorArray(0.5, 0.5, 0.5, 1)' }),
  subResource('GradientTexture2D', 'GradientTexture2D_grey', {
    gradient: 'SubResource("Gradient_grey")',
    width: '8',
    height: '8',
  }),
];

/** A CanvasTexture whose diffuse is the flat grey texture, with `data` laid over it. */
export function canvasTexture(data: Record<string, string>): TscnInternalResource {
  return subResource('CanvasTexture', 'CanvasTexture_1', { diffuse_texture: FLAT_GREY_REF, ...data });
}

/**
 * Renders `item` on a lit canvas with the flat grey texture and `resources` in the scene. The
 * canvas spies on the reads the item declares, and `lists` gives the light list of every placement.
 * `update` swaps the item.
 */
export async function renderOnLitCanvas(
  item: ReactElement,
  resources: readonly TscnInternalResource[],
  lists: CanvasLighting2D['lists'] = INERT_CANVAS_LIGHTING.lists
) {
  const registerItem = vi.fn((_placement: ItemPlacement, _read: LitItemRead) => () => {});
  const lighting: CanvasLighting2D = { ...INERT_CANVAS_LIGHTING, lists, registerItem };
  const loader = createFakeResourceLoader().loader;
  const onLitCanvas = (drawn: ReactElement) => (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={[...FLAT_GREY, ...resources]} externalResources={[]}>
        <CanvasLighting2DContext.Provider value={lighting}>{drawn}</CanvasLighting2DContext.Provider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(onLitCanvas(item));
  /** Renders `next` in place of the item, on the same canvas. */
  const update = (next: ReactElement) => renderer.update(onLitCanvas(next));
  return { renderer, update, registerItem };
}

/** `renderOnLitCanvas` for an item that draws one mesh, which it returns with its map. */
export async function renderLitItem(item: ReactElement, resources: readonly TscnInternalResource[]) {
  const canvas = await renderOnLitCanvas(item, resources);
  return { ...canvas, ...onlyMeshOf(canvas.renderer) };
}

/**
 * `renderLitItem` for a node that mounts through the dispatcher, as a node with internal children
 * does: the node is the root of a scene with the flat grey texture and `resources`.
 */
export async function renderLitScene(node: TscnNode, resources: readonly TscnInternalResource[]) {
  const registerItem = vi.fn((_placement: ItemPlacement, _read: LitItemRead) => () => {});
  const lighting: CanvasLighting2D = { ...INERT_CANVAS_LIGHTING, registerItem };
  const sceneGraph = createSceneGraphFromTscnScene({
    nodes: [node],
    internalResources: [...FLAT_GREY, ...resources],
  });
  const renderer = await renderDispatched2D(sceneGraph, createFakeResourceLoader().loader, lighting);
  return { renderer, registerItem, ...onlyMeshOf(renderer) };
}

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function onlyMeshOf(renderer: Renderer) {
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  const map = (mesh.material as THREE.MeshBasicMaterial).map!;
  return { mesh, map };
}

/** What `describeCanvasTextureItem` reads of a lit render. */
interface LitRender {
  registerItem: ReturnType<typeof vi.fn>;
  map: THREE.Texture;
}

/**
 * The three things every item that draws a CanvasTexture does: declares itself normal-mapped while
 * the CanvasTexture names a normal map, declares none while it names none, and samples with the
 * CanvasTexture's own filter. `render` draws the node with the CanvasTexture `wrapper` in its scene.
 */
export function describeCanvasTextureItem(
  title: string,
  render: (wrapper: TscnInternalResource) => Promise<LitRender>
): void {
  describe(`${title} with a CanvasTexture`, () => {
    it('declares itself normal-mapped while the CanvasTexture names a normal map', async () => {
      const { registerItem } = await render(canvasTexture({ normal_texture: FLAT_GREY_REF }));
      expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'apart');
    });

    it('declares no normal map while the CanvasTexture names none', async () => {
      const { registerItem } = await render(canvasTexture({}));
      expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'plain');
    });

    it("samples the diffuse with the CanvasTexture's own filter", async () => {
      const { map } = await render(canvasTexture({ texture_filter: '1' }));
      expect([map.magFilter, map.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
    });
  });
}

/**
 * The wiring check of a drawer that renders `CanvasMeshBody`, whose own test holds the rest of
 * `describeCanvasTextureItem`: the drawer hands the body the CanvasTexture its `texture` names, so
 * a normal map in it makes the item normal-mapped.
 */
export function itHandsTheBodyItsCanvasTexture(
  render: (wrapper: TscnInternalResource) => Promise<Pick<LitRender, 'registerItem'>>
): void {
  it('hands the canvas mesh body the CanvasTexture its texture names', async () => {
    const { registerItem } = await render(canvasTexture({ normal_texture: FLAT_GREY_REF }));
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'apart');
  });
}
