import { afterEach, describe, expect, it, vi } from 'vitest';
import { sizeEveryElement } from '../../testing/sizeEveryElement';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { Rect2 } from '../../../godot/math/rect2';

/** The edit rect the stub item publishes for the node at `path`. */
const item = vi.hoisted(() => ({ path: 'Main/Sprite', rect: null as Rect2 | null }));

// The world canvas needs WebGL. The stub mounts the keys and one item that publishes its edit rect.
vi.mock('./World2DCanvas', async () => {
  const { FocusSelection2D } = await import('./FocusSelection2D');
  const { NodePathProvider } = await import('../../contexts/NodePathContext');
  const { usePublishEditRect } = await import('../../editRect/editRects');
  function Item() {
    usePublishEditRect(item.rect);
    return null;
  }
  return {
    World2DCanvas: ({ pan, zoom }: { pan: { x: number; y: number }; zoom: number }) => (
      <div data-testid="world" data-pan={`${pan.x},${pan.y}`} data-zoom={zoom}>
        <NodePathProvider path={item.path}>
          <Item />
        </NodePathProvider>
        <FocusSelection2D />
      </div>
    ),
  };
});

import { Canvas2DStage } from './Canvas2DStage';
import { TscnSceneProvider } from '../../TscnSceneProvider';
import { SelectSeeder } from '../../testing/SelectSeeder';
import { openScene } from '../../../scene/openScene';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node2D"]

[node name="Sprite" type="Node2D" parent="."]
position = Vector2(300, 200)
scale = Vector2(2, 2)
`;

const STAGE = { width: 800, height: 600 };

async function mountStage(selected: string | null) {
  sizeEveryElement(STAGE.width, STAGE.height);
  const scene = openScene({ source: SCENE, provider: { loadResource: async () => null } });
  render(
    <TscnSceneProvider scene={scene}>
      <SelectSeeder path={selected} />
      <Canvas2DStage nodes={[]} internalResources={[]} externalResources={[]} scenePath="res://main.tscn" />
    </TscnSceneProvider>
  );
  const stage = await screen.findByTestId('canvas-2d-stage');
  return stage;
}

const world = () => screen.getByTestId('world');

function press(target: HTMLElement, init: KeyboardEventInit) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  item.rect = null;
});

describe('F in the 2D view', () => {
  it('centres the selected item’s edit rect, scaled by its global transform', async () => {
    item.rect = { x: 0, y: 0, w: 32, h: 16 };
    const stage = await mountStage('Main/Sprite');
    const zoom = Number(world().dataset.zoom);

    press(stage, { code: 'KeyF', key: 'f' });

    // The global rect (300, 200, 64, 32) centres at (332, 216), which lands on the stage centre.
    await waitFor(() => {
      const [x, y] = world().dataset.pan!.split(',').map(Number);
      expect(Math.abs(400 - (x! + 332 * zoom))).toBeLessThan(zoom);
      expect(Math.abs(300 - (y! + 216 * zoom))).toBeLessThan(zoom);
    });
  });

  it('centres an item with no edit rect on its origin', async () => {
    const stage = await mountStage('Main/Sprite');
    const zoom = Number(world().dataset.zoom);

    press(stage, { code: 'KeyF', key: 'f' });

    await waitFor(() => {
      const [x] = world().dataset.pan!.split(',').map(Number);
      expect(Math.abs(400 - (x! + 300 * zoom))).toBeLessThan(zoom);
    });
  });

  it('frames the edit rect on Shift+F at 90 % of the tighter side', async () => {
    item.rect = { x: -50, y: -25, w: 100, h: 50 };
    const stage = await mountStage('Main/Sprite');

    press(stage, { code: 'KeyF', key: 'F', shiftKey: true });

    // The global rect is 200 x 100: min(800 / 200, 600 / 100) * 0.9 = 3.6, held to the stage's 4.
    await waitFor(() => expect(Number(world().dataset.zoom)).toBeCloseTo(3.6, 6));
  });

  it('hears no F that reaches the page outside the view', async () => {
    item.rect = { x: -16, y: -8, w: 32, h: 16 };
    await mountStage('Main/Sprite');
    const before = world().dataset.pan;

    press(document.body, { code: 'KeyF', key: 'f' });

    expect(world().dataset.pan).toBe(before);
  });
});
