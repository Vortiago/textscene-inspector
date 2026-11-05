/**
 * <CanvasGroup> through the pass of its canvas: the test renders the group, then runs
 * `drawCanvasGroups` over the scene with a recording renderer, and reads the rect it shows.
 */
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { offscreenRendererState } from '../../viewport/subviewport/offscreenRenderer.testkit';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { CanvasGroup } from './Component';
import { parseCanvasGroup } from './parser';
import { useParentModulate } from '../../../r3f/canvasItemModulate';
import { PaintRangeProvider } from '../../../r3f/contexts/PaintOrderContext';
import { canvasRenderOrder, layerRankOf, layerRanks } from '../../../r3f/canvasPaintOrder';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
} from '../../../r3f/lighting2d/lightPassContext';
import type { CanvasClip } from '../../../r3f/lighting2d/lightPassHost';
import { canvasGroupRectTag, drawCanvasGroups } from '../../../r3f/canvasGroup/canvasGroupPass';
import type { Rgba } from '../../../godot/math/math';

const WORLD_RANK = layerRankOf(layerRanks([]), 0);
const RUN = { base: 10, size: 4 };
/** A key inside the group's run, where a child item draws. */
const CHILD_KEY = canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 0, sequence: RUN.base + 1 });
/** A key outside it, where a child at another `z_final` draws. */
const ESCAPED_KEY = canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 1, sequence: RUN.base + 1 });

/** The root canvas, 1152x648 at the origin. */
const ROOT_CLIP: CanvasClip = { rect: { x: 0, y: -648, w: 1152, h: 648 }, scale: { x: 1, y: 1 } };
const LIGHTING: CanvasLighting2D = {
  ...INERT_CANVAS_LIGHTING,
  registerPassStep: (step) => {
    step(new THREE.OrthographicCamera(), ROOT_CLIP);
    return () => {};
  },
};

function groupNode(props: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name: 'Group',
    type: 'CanvasGroup',
    children: [],
    properties: parseCanvasGroup({ type: 'node', attributes: { type: 'CanvasGroup', name: 'Group' } }, props),
  };
}

/** A 100x100 square at Godot (0, 0)-(100, 100) under a wrapper at `key`, as a child item draws. */
function ChildSquare({ keyed = CHILD_KEY }: { keyed?: number }) {
  return (
    <group renderOrder={keyed}>
      <mesh position={[50, -50, 0]} geometry={new THREE.PlaneGeometry(100, 100)} />
    </group>
  );
}

/** Parks the modulate the children inherit on a mesh's `userData`. */
function ModulateReader() {
  return <object3D name="modulate-reader" userData={{ modulate: useParentModulate() }} />;
}

const MATERIAL: TscnInternalResource = { id: 'Add', type: 'CanvasItemMaterial', data: { blend_mode: '1' } };

async function renderGroup(
  props: Record<string, string> = {},
  child: ReactNode = <ChildSquare />,
  lighting: CanvasLighting2D = LIGHTING
) {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[MATERIAL]} externalResources={[]}>
      <CanvasLighting2DContext.Provider value={lighting}>
        <PaintRangeProvider value={RUN}>
          <CanvasGroup node={groupNode(props)}>
            {child}
            <ModulateReader />
          </CanvasGroup>
        </PaintRangeProvider>
      </CanvasLighting2DContext.Provider>
    </SceneResourcesProvider>
  );
  const scene = renderer.scene.instance as THREE.Object3D;
  const gl = {
    ...offscreenRendererState(),
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    clear: () => {},
    render: () => {},
  } as unknown as THREE.WebGLRenderer;
  drawCanvasGroups(gl, scene, new THREE.OrthographicCamera(), { width: 64, height: 64 }, () => {});
  return { renderer, scene };
}

/** The group's rect meshes: the composite, whose material is a ShaderMaterial, and the plain one. */
/** Whether `object` carries the tag of a group's rect mesh. */
function isCanvasGroupRect(object: THREE.Object3D): boolean {
  return Object.entries(canvasGroupRectTag()).every(([key, value]) => object.userData[key] === value);
}

function rects(scene: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if ((object as THREE.Mesh).isMesh && object.userData.tscnCanvasGroupRect)
      meshes.push(object as THREE.Mesh);
  });
  const composite = meshes.find((mesh) => (mesh.material as THREE.ShaderMaterial).isShaderMaterial)!;
  const plain = meshes.find((mesh) => mesh !== composite)!;
  return { composite, plain };
}

function compositeColour(scene: THREE.Object3D): number[] {
  const material = rects(scene).composite.material as THREE.ShaderMaterial;
  return (material.uniforms.colour!.value as THREE.Vector4).toArray();
}

function inherited(renderer: Awaited<ReturnType<typeof renderGroup>>['renderer']): Rgba {
  return renderer.scene.findByProps({ name: 'modulate-reader' }).instance.userData.modulate as Rgba;
}

describe('<CanvasGroup>', () => {
  it('composites over the children grown by fit_margin', async () => {
    const { scene } = await renderGroup();
    const { composite, plain } = rects(scene);

    expect(composite.visible).toBe(true);
    expect(plain.visible).toBe(false);
    expect(composite.position.toArray()).toEqual([50, -50, 0]);
    expect(composite.scale.toArray()).toEqual([120, 120, 1]);
  });

  it('fits the rect in the clip of the frame camera where no light pass frames the canvas', async () => {
    // The default camera frames 2 units over the 64-pixel frame, so the 10-pixel margin is 10/32.
    const { scene } = await renderGroup({}, <ChildSquare />, INERT_CANVAS_LIGHTING);
    const { composite } = rects(scene);

    expect(composite.visible).toBe(true);
    expect(composite.scale.toArray()).toEqual([100.625, 100.625, 1]);
  });

  it('fits the rect to the children alone at fit_margin 0', async () => {
    const { scene } = await renderGroup({ fit_margin: '0' });

    expect(rects(scene).composite.scale.toArray()).toEqual([100, 100, 1]);
  });

  it('draws nothing with no child at its z_final, as a child at another z escapes the group', async () => {
    const { scene } = await renderGroup({}, <ChildSquare keyed={ESCAPED_KEY} />);
    const { composite, plain } = rects(scene);

    expect([composite.visible, plain.visible]).toEqual([false, false]);
  });

  it('colours the rect by modulate and self_modulate, and passes modulate alone to the children', async () => {
    const { renderer, scene } = await renderGroup({
      modulate: 'Color(1, 1, 1, 0.5)',
      self_modulate: 'Color(1, 0.5, 1, 0.5)',
    });

    expect(compositeColour(scene)).toEqual([1, 0.5, 1, 0.25]);
    expect(inherited(renderer).a).toBe(0.5);
  });

  it('keeps self_modulate off the children', async () => {
    const { renderer } = await renderGroup({ self_modulate: 'Color(1, 1, 1, 0.5)' });

    expect(inherited(renderer).a).toBe(1);
  });

  it('draws a plain rect of the group colour, not the composite, with a CanvasItemMaterial in force', async () => {
    const { scene } = await renderGroup({
      material: 'SubResource("Add")',
      self_modulate: 'Color(1, 1, 1, 0.5)',
    });
    const { composite, plain } = rects(scene);

    expect([composite.visible, plain.visible]).toEqual([false, true]);
    expect((plain.material as THREE.MeshBasicMaterial).opacity).toBe(0.5);
    expect((plain.material as THREE.MeshBasicMaterial).blendDst).toBe(THREE.OneFactor);
  });

  it('draws as a plain Node2D when y-sorted, as Godot groups nothing then', async () => {
    const { scene } = await renderGroup({ y_sort_enabled: 'true' });
    const meshes: THREE.Object3D[] = [];
    scene.traverse((object) => isCanvasGroupRect(object) && meshes.push(object));

    expect(meshes).toEqual([]);
  });
});
