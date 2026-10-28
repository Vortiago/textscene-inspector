/**
 * What a walk of the live tree holds for each canvas: the light lists of every SubViewport, and the
 * CanvasModulate of the walk's own canvas.
 */
import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../parser/types';
import { NOTHING_CACHED } from './cacheSources';
import { canvasScopesOf } from './canvasScopes';
import { liveTreeOf } from './liveSceneTree';

/** One node of a tree under `Root`, named by its path. */
interface Entry {
  path: string;
  type: string;
  properties: Record<string, unknown>;
}

function entry(path: string, type: string, properties: Record<string, unknown> = {}): Entry {
  return { path, type, properties };
}

/** The tree the entries name, under a `Root`. A path an entry does not name is a plain Node2D. */
function treeOf(entries: readonly Entry[]) {
  const nodeAt = (name: string, type: string, properties: Record<string, unknown>): TscnNode =>
    ({ name, type, properties, children: [] }) as never;
  const root = nodeAt('Root', 'Node2D', {});
  const byPath = new Map<string, TscnNode>([['Root', root]]);
  const place = (path: string, type: string, properties: Record<string, unknown>): void => {
    const parentPath = path.slice(0, path.lastIndexOf('/'));
    if (!byPath.has(parentPath)) place(parentPath, 'Node2D', {});
    const node = nodeAt(path.split('/').pop()!, type, properties);
    byPath.set(path, node);
    byPath.get(parentPath)!.children.push(node);
  };
  for (const { path, type, properties } of entries) place(path, type, properties);
  return liveTreeOf([root], { externalResources: [], internalResources: [], sceneCache: NOTHING_CACHED });
}

/**
 * Godot keeps one light list per canvas, and a SubViewport owns a canvas of its own
 * (`viewport.cpp:5345`). The walk is one pass over the tree, split by the nearest SubViewport.
 */
describe('canvasScopesOf, in the light lists', () => {
  const lights = (entries: Entry[], canvas: string | null = null) =>
    canvasScopesOf(treeOf(entries)).lights.get(canvas) ?? { positional: [], directional: [] };

  it('lists a PointLight2D as positional and a DirectionalLight2D as directional, never both', () => {
    // Numbering a sun as positional would leave a hole the 2n / 2n+1 pairing spends for nothing.
    const lists = lights([
      entry('Root/Lamp', 'PointLight2D'),
      entry('Root/Sun', 'DirectionalLight2D', { enabled: true }),
      entry('Root/Sprite', 'Sprite2D'),
    ]);
    expect(lists).toEqual({ positional: ['Root/Lamp'], directional: ['Root/Sun'] });
  });

  it('leaves a disabled or hidden DirectionalLight2D off the directional list', () => {
    const lists = lights([
      entry('Root/Off', 'DirectionalLight2D', { enabled: false }),
      entry('Root/Hidden', 'DirectionalLight2D', { enabled: true, visible: false }),
    ]);
    expect(lists.directional).toEqual([]);
  });

  it('lists the lights of the root canvas in preorder, positional and directional apart', () => {
    const lists = lights([
      entry('Root/Lamp', 'PointLight2D'),
      entry('Root/Sun', 'DirectionalLight2D', { enabled: true }),
      entry('Root/Mid/Lamp', 'PointLight2D'),
    ]);
    expect(lists).toEqual({ positional: ['Root/Lamp', 'Root/Mid/Lamp'], directional: ['Root/Sun'] });
  });

  it('gives the lights below a SubViewport to its own canvas, not the root canvas', () => {
    const entries = [
      entry('Root/Outer', 'PointLight2D'),
      entry('Root/View', 'SubViewport'),
      entry('Root/View/Inner', 'PointLight2D'),
      entry('Root/View/Sun', 'DirectionalLight2D', { enabled: true }),
      entry('Root/Late', 'PointLight2D'),
    ];
    expect(lights(entries)).toEqual({ positional: ['Root/Outer', 'Root/Late'], directional: [] });
    expect(lights(entries, 'Root/View')).toEqual({
      positional: ['Root/View/Inner'],
      directional: ['Root/View/Sun'],
    });
  });

  it('keeps a nested SubViewport out of the canvas that holds it', () => {
    const entries = [
      entry('Root/View', 'SubViewport'),
      entry('Root/View/Lamp', 'PointLight2D'),
      entry('Root/View/Inner', 'SubViewport'),
      entry('Root/View/Inner/Lamp', 'PointLight2D'),
      entry('Root/View/After', 'PointLight2D'),
    ];
    expect(lights(entries, 'Root/View').positional).toEqual(['Root/View/Lamp', 'Root/View/After']);
    expect(lights(entries, 'Root/View/Inner').positional).toEqual(['Root/View/Inner/Lamp']);
  });

  it('leaves a hidden light and a light under a hidden node off the directional list', () => {
    const lists = lights([
      entry('Root/Hidden', 'DirectionalLight2D', { enabled: true, visible: false }),
      entry('Root/Group', 'Node2D', { visible: false }),
      entry('Root/Group/Inner', 'DirectionalLight2D', { enabled: true }),
      entry('Root/Off', 'DirectionalLight2D', { enabled: false }),
      entry('Root/Shown', 'DirectionalLight2D', { enabled: true }),
    ]);
    expect(lists.directional).toEqual(['Root/Shown']);
  });

  it('numbers a hidden positional light, since only a directional light is listed by visibility', () => {
    const lists = lights([
      entry('Root/Group', 'Node2D', { visible: false }),
      entry('Root/Group/Lamp', 'PointLight2D'),
    ]);
    expect(lists.positional).toEqual(['Root/Group/Lamp']);
  });

  it("does not carry a hidden node above a SubViewport into the SubViewport's canvas", () => {
    // A SubViewport is no CanvasItem, so its children do not inherit the hiding (`canvas_item.cpp:309-349`).
    const entries = [
      entry('Root/Group', 'Node2D', { visible: false }),
      entry('Root/Group/View', 'SubViewport'),
      entry('Root/Group/View/Sun', 'DirectionalLight2D', { enabled: true }),
    ];
    expect(lights(entries, 'Root/Group/View').directional).toEqual(['Root/Group/View/Sun']);
  });

  it('stops each directional list at MAX_2D_DIRECTIONAL_LIGHTS, per canvas', () => {
    const names = Array.from({ length: 9 }, (_unused, index) => `S${index}`);
    const entries = [
      ...names.map((name) => entry(`Root/${name}`, 'DirectionalLight2D', { enabled: true })),
      entry('Root/View', 'SubViewport'),
      entry('Root/View/Sun', 'DirectionalLight2D', { enabled: true }),
    ];
    expect(lights(entries).directional).toHaveLength(8);
    expect(lights(entries, 'Root/View').directional).toEqual(['Root/View/Sun']);
  });
});

/**
 * Godot keeps a CanvasModulate on the canvas `get_canvas()` names (`canvas_modulate.cpp:33-34`), and
 * a CanvasLayer has one of its own (`canvas_item.cpp:1131-1139`). A viewport gathers the lights of
 * all its canvases (`renderer_viewport.cpp:443-466`). The two rules differ at a CanvasLayer.
 */
describe('canvasScopesOf, at a CanvasLayer', () => {
  const tint = { r: 1, g: 0, b: 0, a: 1 };
  const scopes = canvasScopesOf(
    treeOf([
      entry('Root/Layer', 'CanvasLayer'),
      entry('Root/Layer/Lamp', 'PointLight2D'),
      entry('Root/Layer/Tint', 'CanvasModulate', { color: tint }),
    ])
  );

  it('lists the lights below a CanvasLayer in the list of its viewport', () => {
    expect(scopes.lights.get(null)?.positional).toEqual(['Root/Layer/Lamp']);
  });

  it('leaves the CanvasModulate below a CanvasLayer to the canvas of that layer', () => {
    expect(scopes.modulate).toBeNull();
  });
});
