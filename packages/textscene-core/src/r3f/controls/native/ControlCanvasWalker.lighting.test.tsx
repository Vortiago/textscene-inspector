/**
 * A Control is a CanvasItem, so the 2D light pass lights it: the walker declares each Control to
 * the pass at its `light_mask` and `z_final`, and the quad its painter draws samples the light list.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactNode } from 'react';
import type { Rect2 } from '../../../godot/math/rect2';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { controlNode, solveNode as solveNodeDefaults } from './testing/solveNode';
import type { SceneScope } from '../../../parser/types';
import { ROOT_TEXTURE_SAMPLER } from '../../canvasItemTextureSampler';
import type { SolveNode } from './solveTree';
import { controlComponentRegistry, type NativeControlComponent } from '../ControlComponentRegistry';
import { ControlQuad } from './controlQuad';
import { CanvasLighting2DContext } from '../../lighting2d/lightPassContext';
import { recordedItems } from '../../lighting2d/testing/recordedItems';
import type { ItemPlacement } from '../../lighting2d/itemLightList';

vi.mock('../../contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const LIGHT_PROGRAM_KEY = 'godot-canvas-light';

const QuadPainter: NativeControlComponent = ({ rect, renderOrder }) => (
  <ControlQuad
    width={rect.w}
    height={rect.h}
    color={new THREE.Color(1, 1, 1)}
    opacity={1}
    renderOrder={renderOrder}
  />
);

function control(properties: Record<string, unknown>): SolveNode {
  return {
    ...solveNodeDefaults(),
    path: 'Rect',
    node: controlNode('Rect', 'TestRect', { name: 'Rect', ...properties }),
  };
}

function withRegisteredItems(): { wrapper: (children: ReactNode) => ReactNode; placements: ItemPlacement[] } {
  const { lighting, placements } = recordedItems();
  return {
    placements,
    wrapper: (children) => (
      <CanvasLighting2DContext.Provider value={lighting}>{children}</CanvasLighting2DContext.Provider>
    ),
  };
}

function walk(node: SolveNode) {
  return (
    <ControlCanvasWalker
      tree={[node]}
      generation={0}
      viewport={VIEWPORT}
      theme={nativeTheme(1)}
      measurer={null}
    />
  );
}

describe('<ControlCanvasWalker> lighting', () => {
  afterEach(() => controlComponentRegistry.clear());

  it('declares a Control to the light pass at its light_mask and z_final', async () => {
    controlComponentRegistry.register({ typeName: 'TestRect', Component: QuadPainter });
    const { wrapper, placements } = withRegisteredItems();

    await ReactThreeTestRenderer.create(
      wrapper(walk(control({ anchorsPreset: 15, lightMask: 4, zIndex: 3 })))
    );

    expect(placements).toContainEqual({ lightMask: 4, z: 3, layer: 0, takenLights: null });
  });

  it('declares no item for a CanvasLayer, which is no CanvasItem and holds the lights of its layer', async () => {
    controlComponentRegistry.register({
      typeName: 'CanvasLayer',
      Component: QuadPainter,
      wrapsChildren: true,
    });
    const { wrapper, placements } = withRegisteredItems();
    const layer: SolveNode = {
      ...solveNodeDefaults(),
      path: 'Layer',
      node: controlNode('Layer', 'CanvasLayer', { name: 'Layer' }),
    };

    await ReactThreeTestRenderer.create(wrapper(walk(layer)));

    expect(placements).toEqual([]);
  });

  it("takes the material of a skipped Node2D ancestor for a Control that uses its parent's material", async () => {
    controlComponentRegistry.register({ typeName: 'TestRect', Component: QuadPainter });
    const additive: SceneScope = {
      internalResources: [{ id: 'add', type: 'CanvasItemMaterial', data: { blend_mode: '1' } }],
      externalResources: [],
    };
    const promoted: SolveNode = {
      ...control({ anchorsPreset: 15, useParentMaterial: true }),
      skippedAncestors: {
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        modulate: { r: 1, g: 1, b: 1, a: 1 },
        z: [],
        sampler: ROOT_TEXTURE_SAMPLER,
        material: { kind: 'own', ref: 'SubResource("add")', resources: additive },
      },
    };

    const renderer = await ReactThreeTestRenderer.create(walk(promoted));

    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
    expect(material.blendDst).toBe(THREE.OneFactor);
  });

  it('compiles the quad a painter draws with the light list sampling', async () => {
    controlComponentRegistry.register({ typeName: 'TestRect', Component: QuadPainter });

    const renderer = await ReactThreeTestRenderer.create(walk(control({ anchorsPreset: 15 })));

    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
    expect(material.customProgramCacheKey()).toContain(LIGHT_PROGRAM_KEY);
  });
});
