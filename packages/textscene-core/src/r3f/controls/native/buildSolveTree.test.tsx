/**
 * `useBuildSolveTree` walks the **Live scene tree** (`liveSceneTree.ts`,
 * ADR-0013) into the `SolveNode` forest the native rect solver consumes.
 * These scenarios port `ControlOverlay.instances.test.tsx`'s instancing
 * fixtures onto the SolveNode seam instead of the DOM: a `.tscn` composed the
 * normal Godot way (a HUD instanced into a level, a widget instanced into
 * that HUD) must not lose content or resolve a StyleBox/texture against the
 * wrong scene's resource pool.
 *
 * Non-Control ancestors (a `Node3D` housing an instanced HUD, the raw `Node`
 * an unresolved/multi-root instance parses as) are transparent: they are not
 * genuine Control types (`TWO_D_UI_TYPES`, the same mirror `has2DUIContent`
 * reads), so they contribute no SolveNode of their own — their Control
 * descendants surface directly, at whatever depth they are actually
 * authored, exactly like the DOM overlay's `display: contents` passthrough
 * keeps a non-Control ancestor from ever becoming a CSS containing block.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource, TscnNode, TscnScene } from '../../../parser/types';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { useBuildSolveTree } from './buildSolveTree';

const LAYER_PATH = 'res://hud-layer.tscn';
const BADGE_PATH = 'res://hud-badge.tscn';

function node(name: string, type: string, extra: Partial<TscnNode> = {}): TscnNode {
  return {
    name,
    type,
    children: [],
    properties: { name } as Record<string, unknown>,
    ...extra,
  } as TscnNode;
}

function label(name: string, extra: Record<string, unknown> = {}): TscnNode {
  return node(name, 'Label', { properties: { name, ...extra } as Record<string, unknown> });
}

function scene(
  nodes: TscnNode[],
  externalResources: TscnExternalResource[] = [],
  internalResources: TscnInternalResource[] = []
): TscnScene {
  return { nodes, internalResources, externalResources } as TscnScene;
}

function instanceOf(name: string, id: string, type = 'Node'): TscnNode {
  return node(name, type, { instance: `ExtResource("${id}")` });
}

function wrapperFor(loader: ReturnType<typeof createFakeResourceLoader>['loader']) {
  return ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
  );
}

describe('useBuildSolveTree — instanced sub-scenes', () => {
  it('collapses a single-root instance into the sub-scene root (merged group, sub-scene scope)', () => {
    const loader = createFakeResourceLoader();
    loader.scenes.seed(LAYER_PATH, scene([label('LayerLabel', { text: 'HUD LAYER' })]));

    const nodes = [instanceOf('Hud', '1_layer')];
    const externalResources = [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree).toHaveLength(1);
    expect(result.current.tree[0]?.path).toBe('Hud');
    expect(result.current.tree[0]?.node.type).toBe('Label');
    expect(result.current.tree[0]?.node.properties).toMatchObject({ text: 'HUD LAYER' });
  });

  it('keeps a non-Control ancestor (Node3D) transparent, surfacing the instanced Control beneath it', () => {
    const loader = createFakeResourceLoader();
    loader.scenes.seed(LAYER_PATH, scene([label('LayerLabel', { text: 'HUD LAYER' })]));

    const nodes = [node('Root', 'Node3D', { children: [instanceOf('Hud', '1_layer')] })];
    const externalResources = [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    // 'Root' (Node3D) is not a Control type, so it contributes no SolveNode —
    // its instanced descendant is promoted straight to the top-level forest.
    // The PATH stays faithful to the true hierarchy (hiddenNodePaths/selection
    // still need to address 'Root/Hud'), even though it is no longer nested
    // under a SolveNode for 'Root'.
    expect(result.current.tree).toHaveLength(1);
    expect(result.current.tree[0]?.path).toBe('Root/Hud');
    expect(result.current.tree[0]?.node.type).toBe('Label');
  });

  it('renders Controls nested two instances deep, each collapsing in turn', () => {
    const loader = createFakeResourceLoader();
    loader.scenes.seed(
      LAYER_PATH,
      scene(
        [
          node('HudLayer', 'CanvasLayer', {
            children: [label('LayerLabel', { text: 'HUD LAYER' }), instanceOf('Badge', '1_badge')],
          }),
        ],
        [{ id: '1_badge', path: BADGE_PATH, type: 'PackedScene' }]
      )
    );
    loader.scenes.seed(BADGE_PATH, scene([label('BadgeLabel', { text: 'BADGE' })]));

    const nodes = [node('Root', 'Node3D', { children: [instanceOf('Hud', '1_layer')] })];
    const externalResources = [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree).toHaveLength(1);
    const hud = result.current.tree[0]!;
    expect(hud.path).toBe('Root/Hud');
    expect(hud.node.type).toBe('CanvasLayer');
    expect(hud.children.map((c) => c.node.type).sort()).toEqual(['Label', 'Label'].sort());
    const badge = hud.children.find((c) => c.path === 'Root/Hud/Badge');
    expect(badge?.node.type).toBe('Label');
    expect(badge?.node.properties).toMatchObject({ text: 'BADGE' });
  });

  it('a multi-root instance keeps the node with subscene roots beneath it, host children staying inline in OUTER scope', () => {
    // Godot HUDs are normally instanced from a single-root .tscn, but a
    // multi-root one never collapses (ADR-0013) — the instance node itself
    // stays, with the loaded roots injected beneath it (sub-scene scope) and
    // any host-authored children of the instance node keeping OUTER scope.
    const loader = createFakeResourceLoader();
    loader.scenes.seed(LAYER_PATH, scene([label('First', { text: 'FIRST ROOT' }), label('Second', { text: 'SECOND ROOT' })]));

    const hostChild = label('HostAdded', { text: 'HOST TEXT' });
    const nodes = [instanceOf('Hud', '1_layer', 'Control')];
    (nodes[0] as TscnNode).children = [hostChild];
    const externalResources = [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree).toHaveLength(1);
    const hud = result.current.tree[0]!;
    expect(hud.path).toBe('Hud');
    expect(hud.node.type).toBe('Control'); // the instance node itself, un-collapsed
    const childTexts = hud.children.map((c) => (c.node.properties as { text?: string }).text).sort();
    expect(childTexts).toEqual(['FIRST ROOT', 'HOST TEXT', 'SECOND ROOT']);
  });

  it("resolves a sub-scene's StyleBox AND texture in the SUB-SCENE's resource pool, not the host's", () => {
    // Host and sub-scene both declare id "1" for DIFFERENT StyleBoxes/textures —
    // the shape a real project produces, since ids are per-file. Resolving
    // against the wrong pool would silently pick the HOST's resource instead
    // of failing, so this fixture makes a scope mistake loud (wrong numbers)
    // rather than quiet (missing content).
    const loader = createFakeResourceLoader();
    const subTexturePath = 'res://sub-icon.png';
    const hostTexturePath = 'res://HOST-icon.png';
    loader.textures.seed(subTexturePath, { image: { width: 40, height: 20 } } as unknown as THREE.Texture);
    loader.textures.seed(hostTexturePath, { image: { width: 999, height: 999 } } as unknown as THREE.Texture);

    const subScenePanel = node('Panel', 'Panel', {
      properties: {
        name: 'Panel',
        themeOverrideStyles: { panel: 'SubResource("1")' },
        texture: 'ExtResource("1")',
      } as Record<string, unknown>,
    });
    loader.scenes.seed(
      LAYER_PATH,
      scene(
        [subScenePanel],
        [{ id: '1', path: subTexturePath, type: 'Texture2D' }],
        [{ id: '1', type: 'StyleBoxFlat', data: { bg_color: 'Color(0.1, 0.2, 0.3, 1)' } }]
      )
    );

    const nodes = [instanceOf('Hud', '1_layer')];
    const externalResources = [
      { id: '1_layer', path: LAYER_PATH, type: 'PackedScene' },
      { id: '1', path: hostTexturePath, type: 'Texture2D' },
    ];
    const internalResources: TscnInternalResource[] = [
      { id: '1', type: 'StyleBoxFlat', data: { bg_color: 'Color(0.9, 0.9, 0.9, 1)' } },
    ];

    const { result } = renderHook(
      () => useBuildSolveTree(nodes, externalResources, internalResources),
      { wrapper: wrapperFor(loader.loader) }
    );

    const solved = result.current.tree[0]!;
    expect(solved.styleBoxes.panel?.bgColor).toEqual({ r: 0.1, g: 0.2, b: 0.3, a: 1 });
    expect(solved.textureSize).toEqual({ x: 40, y: 20 });
  });

  it('generation bumps when a not-yet-cached sub-scene arrives, and the tree picks it up', async () => {
    const loader = createFakeResourceLoader();
    const nodes = [instanceOf('Hud', '1_layer')];
    const externalResources = [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    const initialGeneration = result.current.generation;
    // Cold cache: the instance node itself isn't a Control, and nothing has
    // loaded yet, so the forest is empty.
    expect(result.current.tree).toHaveLength(0);

    await act(async () => {
      loader.scenes._resolve(LAYER_PATH, scene([label('LayerLabel', { text: 'HUD LAYER' })]));
    });

    expect(result.current.generation).toBeGreaterThan(initialGeneration);
    expect(result.current.tree).toHaveLength(1);
    expect(result.current.tree[0]?.node.properties).toMatchObject({ text: 'HUD LAYER' });
  });

  it('an empty Control-free subtree solves to an empty forest (edge case)', () => {
    const loader = createFakeResourceLoader();
    const nodes = [node('Mesh', 'MeshInstance3D'), node('Timer', 'Timer')];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree).toEqual([]);
  });

  it('works with no ResourceLoaderProvider mounted (unresolved instance stays inert)', () => {
    const nodes = [instanceOf('Hud', '1_layer')];
    const externalResources = [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []));

    expect(result.current.tree).toEqual([]);
  });
});
