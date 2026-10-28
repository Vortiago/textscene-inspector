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

const lamp = (path: string) => entry(path, 'PointLight2D');
const sun = (path: string) => entry(path, 'DirectionalLight2D', { enabled: true });
const suns = (prefix: string, count: number) =>
  Array.from({ length: count }, (_unused, index) => sun(`${prefix}${index}`));

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
const lights = (entries: Entry[], canvas: string | null = null) =>
  canvasScopesOf(treeOf(entries)).lights.get(canvas) ?? { positional: [], directional: [] };

describe('canvasScopesOf, in the light lists', () => {
  it('lists a PointLight2D as positional and a DirectionalLight2D as directional, never both', () => {
    // Numbering a sun as positional would leave a hole the 2n / 2n+1 pairing spends for nothing.
    const lists = lights([lamp('Root/Lamp'), sun('Root/Sun'), entry('Root/Sprite', 'Sprite2D')]);
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
    const lists = lights([lamp('Root/Lamp'), sun('Root/Sun'), lamp('Root/Mid/Lamp')]);
    expect(lists).toEqual({ positional: ['Root/Lamp', 'Root/Mid/Lamp'], directional: ['Root/Sun'] });
  });

  it('gives the lights below a SubViewport to its own canvas, not the root canvas', () => {
    const entries = [
      lamp('Root/Outer'),
      entry('Root/View', 'SubViewport'),
      lamp('Root/View/Inner'),
      sun('Root/View/Sun'),
      lamp('Root/Late'),
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
      lamp('Root/View/Lamp'),
      entry('Root/View/Inner', 'SubViewport'),
      lamp('Root/View/Inner/Lamp'),
      lamp('Root/View/After'),
    ];
    expect(lights(entries, 'Root/View').positional).toEqual(['Root/View/Lamp', 'Root/View/After']);
    expect(lights(entries, 'Root/View/Inner').positional).toEqual(['Root/View/Inner/Lamp']);
  });

  it('leaves a hidden light and a light under a hidden node off the directional list', () => {
    const lists = lights([
      entry('Root/Hidden', 'DirectionalLight2D', { enabled: true, visible: false }),
      entry('Root/Group', 'Node2D', { visible: false }),
      sun('Root/Group/Inner'),
      entry('Root/Off', 'DirectionalLight2D', { enabled: false }),
      sun('Root/Shown'),
    ]);
    expect(lists.directional).toEqual(['Root/Shown']);
  });

  it('numbers a hidden positional light, since only a directional light is listed by visibility', () => {
    const lists = lights([entry('Root/Group', 'Node2D', { visible: false }), lamp('Root/Group/Lamp')]);
    expect(lists.positional).toEqual(['Root/Group/Lamp']);
  });

  it("does not carry a hidden node above a SubViewport into the SubViewport's canvas", () => {
    // A SubViewport is no CanvasItem, so its children do not inherit the hiding (`canvas_item.cpp:309-349`).
    const entries = [
      entry('Root/Group', 'Node2D', { visible: false }),
      entry('Root/Group/View', 'SubViewport'),
      sun('Root/Group/View/Sun'),
    ];
    expect(lights(entries, 'Root/Group/View').directional).toEqual(['Root/Group/View/Sun']);
  });

  it('stops each directional list at MAX_2D_DIRECTIONAL_LIGHTS, per canvas', () => {
    const entries = [...suns('Root/S', 9), entry('Root/View', 'SubViewport'), sun('Root/View/Sun')];
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
      lamp('Root/Layer/Lamp'),
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

/**
 * Godot walks the canvases of a viewport in the order they attached (`renderer_viewport.cpp:441`):
 * its own first, then each CanvasLayer in tree order. MIX against ADD does not commute.
 */
describe('canvasScopesOf, in the order of the lists', () => {
  const layer = entry('Root/Layer', 'CanvasLayer');

  it('lists the root canvas before a CanvasLayer that sits earlier in the tree', () => {
    const { positional } = lights([layer, lamp('Root/Layer/Mix'), lamp('Root/Add')]);
    expect(positional).toEqual(['Root/Add', 'Root/Layer/Mix']);
  });

  it('lists the CanvasLayers in tree order, not by layer index', () => {
    const { positional } = lights([
      entry('Root/High', 'CanvasLayer', { layer: 5 }),
      lamp('Root/High/Add'),
      entry('Root/Low', 'CanvasLayer', { layer: 1 }),
      lamp('Root/Low/Mix'),
    ]);
    expect(positional).toEqual(['Root/High/Add', 'Root/Low/Mix']);
  });

  it('lists a nested CanvasLayer after the lights of the layer that holds it', () => {
    const { positional } = lights([
      entry('Root/Outer', 'CanvasLayer'),
      entry('Root/Outer/Inner', 'CanvasLayer'),
      lamp('Root/Outer/Inner/Deep'),
      lamp('Root/Outer/Shallow'),
    ]);
    expect(positional).toEqual(['Root/Outer/Shallow', 'Root/Outer/Inner/Deep']);
  });

  it('lists a ParallaxBackground as a canvas of its own, as a CanvasLayer subclass', () => {
    const { positional } = lights([
      entry('Root/Back', 'ParallaxBackground'),
      lamp('Root/Back/Mix'),
      lamp('Root/Add'),
    ]);
    expect(positional).toEqual(['Root/Add', 'Root/Back/Mix']);
  });

  it('lists the directional lights of the root canvas first as well', () => {
    const { directional } = lights([layer, sun('Root/Layer/Blue'), sun('Root/Sun')]);
    expect(directional).toEqual(['Root/Sun', 'Root/Layer/Blue']);
  });

  // The gather stops at the eighth light with a `break` that leaves only the loop of the canvas it
  // is in (`renderer_viewport.cpp:511`), so the next canvas lists its lights past the cap.
  it('lists a CanvasLayer light past the eighth of the root canvas', () => {
    const { directional } = lights([...suns('Root/S', 9), layer, sun('Root/Layer/Blue')]);
    expect(directional).toHaveLength(9);
    expect(directional.at(-1)).toBe('Root/Layer/Blue');
  });

  // The render's budget counts the lights of each canvas layer apart, so the lists keep them all
  // (`itemLightCap.ts`).
  it('lists every directional light past the eighth, whatever their number', () => {
    const { directional } = lights([...suns('Root/S', 8), layer, ...suns('Root/Layer/L', 300)]);
    expect(directional).toHaveLength(308);
  });

  it('stops inside the canvas that reaches the eighth light', () => {
    const entries = [...suns('Root/S', 5), layer, ...suns('Root/Layer/L', 6)];
    expect(lights(entries).directional).toHaveLength(8);
  });
});
