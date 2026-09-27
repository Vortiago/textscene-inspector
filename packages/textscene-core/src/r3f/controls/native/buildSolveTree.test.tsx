/**
 * `useBuildSolveTree` walks the **Live scene tree** (ADR-0013) into `SolveNode`s.
 * An instanced HUD or widget must keep its content and resolve each StyleBox and
 * texture in its own scene's pool. A non-Control ancestor gets no SolveNode, and
 * its Control descendants surface at their authored depth.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource, TscnNode, TscnScene } from '../../../parser/types';
import { parseTresFile, type ParsedResource } from '../../../parser/parsedResource';
import { FileEventBus } from '../../../resources/FileEventBus';
import { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { countedTable } from '../../../resources/testing/countedTable';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { HiddenSeeder } from '../../testing/HiddenSeeder';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import type { FontResource } from '../../../resources/fonts/font/types';
import { resolveSceneFontMetrics } from './text/sceneFontLoader';
import { useBuildSolveTree } from './buildSolveTree';
import { TscnParser } from '../../../parser/TscnParser';
import { createSolveContext, solveControlTree, type SolvedControl } from './controlRectSolver';
import type { SolveNode } from './solveTree';
import { nativeTheme } from './nativeTheme';
import type { Rect2 } from './rect';
// Side-effect imports: the node parsers that turn the `.tscn` text below into
// typed Control properties, and the solvers/minimum-size functions the solved
// rects come from.
import '../../nodes/index';
import '../index';

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

    // 'Root' (Node3D) gets no SolveNode, so its instanced descendant is a forest
    // root. The path stays 'Root/Hud', which hiddenNodePaths and selection address.
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
    // A multi-root instance never collapses (ADR-0013): the instance node stays,
    // its loaded roots in sub-scene scope and host-authored children in outer scope.
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
    // Host and sub-scene both declare id "1" for different resources, as per-file
    // ids allow, so a scope mistake gives wrong numbers, not missing content.
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

  it("resolves a HOST-authored child's StyleBox in the HOST's pool, even when it hangs off an instance node", () => {
    // The host half of the scope: the `inline` group gets the host pool only
    // because the walk passes an optional argument down, so dropping it fails
    // silently. Both pools declare id "1" for different colours, so the wrong
    // pool gives wrong numbers.
    const loader = createFakeResourceLoader();
    loader.scenes.seed(
      LAYER_PATH,
      scene(
        [label('FirstRoot', { text: 'FIRST ROOT' }), label('SecondRoot', { text: 'SECOND ROOT' })],
        [],
        [{ id: '1', type: 'StyleBoxFlat', data: { bg_color: 'Color(0.1, 0.2, 0.3, 1)' } }]
      )
    );

    const hostPanel = node('HostPanel', 'Panel', {
      properties: {
        name: 'HostPanel',
        themeOverrideStyles: { panel: 'SubResource("1")' },
      } as Record<string, unknown>,
    });
    const hud = instanceOf('Hud', '1_layer', 'Control');
    const nodes = [{ ...hud, children: [hostPanel] } as TscnNode];

    const { result } = renderHook(
      () =>
        useBuildSolveTree(
          nodes,
          [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }],
          [{ id: '1', type: 'StyleBoxFlat', data: { bg_color: 'Color(0.9, 0.9, 0.9, 1)' } }]
        ),
      { wrapper: wrapperFor(loader.loader) }
    );

    const solvedHud = result.current.tree[0]!;
    const panel = solvedHud.children.find((c) => c.node.name === 'HostPanel');
    expect(panel, 'the host-authored Panel must survive the instance split').toBeDefined();
    expect(panel!.styleBoxes.panel?.bgColor).toEqual({ r: 0.9, g: 0.9, b: 0.9, a: 1 });
  });

  it("populates a top-level TextureRect's own textureSize from its `texture` property, no instancing involved", () => {
    // `resolveTextureSize` reads `node.properties.texture` for any 2D-UI node.
    // TextureRect's minimum-size solver consumes it.
    const loader = createFakeResourceLoader();
    const texturePath = 'res://portrait.png';
    loader.textures.seed(texturePath, { image: { width: 320, height: 160 } } as unknown as THREE.Texture);

    const nodes = [
      node('Portrait', 'TextureRect', { properties: { name: 'Portrait', texture: 'ExtResource("1")' } }),
    ];
    const externalResources = [{ id: '1', path: texturePath, type: 'Texture2D' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree).toHaveLength(1);
    expect(result.current.tree[0]?.textureSize).toEqual({ x: 320, y: 160 });
  });

  it("populates a top-level Button's own textureSize from its `icon` property (Button has no `texture` field at all)", () => {
    // Button's minimum-size solver needs its icon's size, and no type carries
    // both `texture` and `icon`.
    const loader = createFakeResourceLoader();
    const iconPath = 'res://icon.png';
    loader.textures.seed(iconPath, { image: { width: 24, height: 24 } } as unknown as THREE.Texture);

    const nodes = [node('IconButton', 'Button', { properties: { name: 'IconButton', icon: 'ExtResource("1")' } })];
    const externalResources = [{ id: '1', path: iconPath, type: 'Texture2D' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree).toHaveLength(1);
    expect(result.current.tree[0]?.textureSize).toEqual({ x: 24, y: 24 });
  });

  it("takes a TextureRect's textureSize from an INLINE GradientTexture2D, with no loader round trip", () => {
    // An inline procedural texture never reaches the loader, so a path-only
    // resolution gives a (0, 0) minimum. Godot 4.6.3 pushes the ColorRect below
    // a 160x160 GradientTexture2D in a VBoxContainer down by 160 px.
    const loader = createFakeResourceLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'Gradient_1', type: 'Gradient', data: { colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)' } },
      {
        id: 'GradientTexture2D_1',
        type: 'GradientTexture2D',
        data: { gradient: 'SubResource("Gradient_1")', width: '160', height: '160' },
      },
    ];
    const nodes = [
      node('Ramp', 'TextureRect', {
        properties: { name: 'Ramp', texture: 'SubResource("GradientTexture2D_1")' },
      }),
    ];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], internalResources), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.textureSize).toEqual({ x: 160, y: 160 });
  });

  it("takes a TextureRect's textureSize from an inline AtlasTexture's REGION, never the sheet's size", () => {
    // `AtlasTexture::get_width`/`get_height` (`scene/resources/atlas_texture.cpp`
    // :33-53) report `rounded_region.size + margin.size`, so a Control reserves
    // the cell, not the 1024x1024 sheet that the sheet's path would answer.
    const loader = createFakeResourceLoader();
    const sheetPath = 'res://sheet.png';
    loader.textures.seed(sheetPath, { image: { width: 1024, height: 1024 } } as unknown as THREE.Texture);
    const internalResources: TscnInternalResource[] = [
      {
        id: 'AtlasTexture_cell',
        type: 'AtlasTexture',
        data: { atlas: 'ExtResource("1")', region: 'Rect2(64, 128, 48, 24)' },
      },
      {
        id: 'AtlasTexture_margined',
        type: 'AtlasTexture',
        data: {
          atlas: 'ExtResource("1")',
          region: 'Rect2(0, 0, 48, 24)',
          margin: 'Rect2(4, 4, 16, 8)',
        },
      },
    ];
    const nodes = [
      node('Cell', 'TextureRect', {
        properties: { name: 'Cell', texture: 'SubResource("AtlasTexture_cell")' },
      }),
      node('Padded', 'TextureRect', {
        properties: { name: 'Padded', texture: 'SubResource("AtlasTexture_margined")' },
      }),
    ];

    const { result } = renderHook(
      () => useBuildSolveTree(nodes, [{ id: '1', path: sheetPath, type: 'Texture2D' }], internalResources),
      { wrapper: wrapperFor(loader.loader) }
    );

    expect(result.current.tree[0]?.textureSize).toEqual({ x: 48, y: 24 });
    expect(result.current.tree[1]?.textureSize).toEqual({ x: 64, y: 32 });
  });

  it("takes a Button's textureSize from an INLINE GradientTexture2D icon", () => {
    // The icon slot resolves separately from every other Texture2D slot, and
    // feeds `buttonMinimumSize`. Measured against Godot 4.6.3: a 96x96 inline
    // icon plus 8 px content margins gives the Button a 112 px height.
    const loader = createFakeResourceLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'Gradient_1', type: 'Gradient', data: { colors: 'PackedColorArray(1, 1, 0, 1, 1, 0, 0, 1)' } },
      {
        id: 'GradientTexture2D_1',
        type: 'GradientTexture2D',
        data: { gradient: 'SubResource("Gradient_1")', width: '96', height: '96', fill: '1' },
      },
    ];
    const nodes = [
      node('IconButton', 'Button', {
        properties: { name: 'IconButton', icon: 'SubResource("GradientTexture2D_1")' },
      }),
    ];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], internalResources), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.textureSize).toEqual({ x: 96, y: 96 });
  });

  it('leaves textureSize null for a Button with no icon at all (no `texture`/`icon` property to resolve)', () => {
    const loader = createFakeResourceLoader();
    const nodes = [node('PlainButton', 'Button', { properties: { name: 'PlainButton', text: 'Click Me' } })];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.textureSize).toBeNull();
  });

  it("generation bumps when a TextureRect's not-yet-cached texture resolves, and the tree picks up its size", async () => {
    const loader = createFakeResourceLoader();
    const texturePath = 'res://portrait.png';
    const nodes = [
      node('Portrait', 'TextureRect', { properties: { name: 'Portrait', texture: 'ExtResource("1")' } }),
    ];
    const externalResources = [{ id: '1', path: texturePath, type: 'Texture2D' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    const initialGeneration = result.current.generation;
    expect(result.current.tree[0]?.textureSize).toBeNull();

    await act(async () => {
      loader.textures._resolve(texturePath, { image: { width: 320, height: 160 } } as unknown as THREE.Texture);
    });

    expect(result.current.generation).toBeGreaterThan(initialGeneration);
    expect(result.current.tree[0]?.textureSize).toEqual({ x: 320, y: 160 });
  });

  it('generation bumps when a not-yet-cached sub-scene arrives, and the tree picks it up', async () => {
    const loader = createFakeResourceLoader();
    const nodes = [instanceOf('Hud', '1_layer')];
    const externalResources = [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    const initialGeneration = result.current.generation;
    // Cold cache: the instance node itself is not a Control, and nothing has
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

/** A Node2D-shaped node with every transform field stated. */
function node2D(
  name: string,
  transform: { position?: { x: number; y: number }; rotation?: number; scale?: { x: number; y: number }; skew?: number },
  extra: Partial<TscnNode> = {}
): TscnNode {
  const { properties: extraProperties, ...rest } = extra;
  return node(name, 'Node2D', {
    properties: {
      name,
      position: transform.position ?? { x: 0, y: 0 },
      rotation: transform.rotation ?? 0,
      scale: transform.scale ?? { x: 1, y: 1 },
      skew: transform.skew ?? 0,
      ...extraProperties,
    } as Record<string, unknown>,
    ...rest,
  });
}

describe('useBuildSolveTree — a promoted Control accumulates its skipped Node2D ancestors’ transform, modulate and z', () => {
  it('translation only', async () => {
    // core/math/transform_2d.h:249-254, rotation=0 scale=(1,1): a=1,b=0,c=0,d=1.
    const nodes = [node2D('N', { position: { x: 100, y: 50 } }, { children: [label('L')] })];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree[0]!.skippedAncestors!.transform).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 100, ty: 50 });
  });

  it('rotation only', async () => {
    // core/math/transform_2d.h:249-254 at rot=PI/2, scale=(1,1), skew=0:
    // a=cos(PI/2)=0, b=sin(PI/2)=1, c=-sin(PI/2)=-1, d=cos(PI/2)=0.
    const nodes = [node2D('N', { rotation: Math.PI / 2 }, { children: [label('L')] })];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const t = result.current.tree[0]!.skippedAncestors!.transform;
    expect(t.a).toBeCloseTo(0, 10);
    expect(t.b).toBeCloseTo(1, 10);
    expect(t.c).toBeCloseTo(-1, 10);
    expect(t.d).toBeCloseTo(0, 10);
    expect(t.tx).toBe(0);
    expect(t.ty).toBe(0);
  });

  it('scale only, non-uniform', async () => {
    // core/math/transform_2d.h:249-254 at rot=0, skew=0: a=scale.x, d=scale.y.
    const nodes = [node2D('N', { scale: { x: 2, y: 3 } }, { children: [label('L')] })];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree[0]!.skippedAncestors!.transform).toEqual({ a: 2, b: 0, c: 0, d: 3, tx: 0, ty: 0 });
  });

  it('translation + rotation + scale together', async () => {
    // core/math/transform_2d.h:249-254 at rot=PI/2, scale=(2,3), skew=0:
    // a=cos(PI/2)*2=0, b=sin(PI/2)*2=2, c=-sin(PI/2)*3=-3, d=cos(PI/2)*3=0.
    const nodes = [
      node2D('N', { position: { x: 10, y: 20 }, rotation: Math.PI / 2, scale: { x: 2, y: 3 } }, { children: [label('L')] }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const t = result.current.tree[0]!.skippedAncestors!.transform;
    expect(t.a).toBeCloseTo(0, 10);
    expect(t.b).toBeCloseTo(2, 10);
    expect(t.c).toBeCloseTo(-3, 10);
    expect(t.d).toBeCloseTo(0, 10);
    expect(t.tx).toBe(10);
    expect(t.ty).toBe(20);
  });

  it('composes two chained Node2D ancestors, outer first — Transform2D::operator*, core/math/transform_2d.cpp:198-217', async () => {
    // Outer only translates and inner only rotates, so the composed origin is the
    // outer's and the basis the inner's: both multiplied, neither masked.
    const outer = node2D('Outer', { position: { x: 100, y: 50 } }, {
      children: [node2D('Inner', { rotation: Math.PI / 2 }, { children: [label('L')] })],
    });
    const { result } = renderHook(() => useBuildSolveTree([outer], [], []));
    const t = result.current.tree[0]!.skippedAncestors!.transform;
    expect(t.a).toBeCloseTo(0, 10);
    expect(t.b).toBeCloseTo(1, 10);
    expect(t.c).toBeCloseTo(-1, 10);
    expect(t.d).toBeCloseTo(0, 10);
    expect(t.tx).toBe(100);
    expect(t.ty).toBe(50);
  });

  it('resets to null at a non-CanvasItem break, rather than carrying the Node2D above it', async () => {
    // `CanvasItem::get_parent_item()` casts only the DIRECT parent
    // (scene/main/canvas_item.cpp:565-571); a plain `Node` parent fails that
    // cast, so the RenderingServer parents past it at the canvas root, never
    // at the Node2D further up (`_enter_canvas`, canvas_item.cpp:234-285).
    const nodes = [
      node2D('N', { rotation: Math.PI / 2 }, {
        children: [node('Group', 'Node', { children: [label('L')] })],
      }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree[0]!.skippedAncestors).toBeNull();
  });

  it('a CanvasLayer under a rotated Node2D gets no ancestor transform, and neither do ITS children', async () => {
    // CanvasLayer derives from Node, so `get_parent_item()` never climbs it: its
    // children parent at `canvas_layer->get_canvas()` (canvas_item.cpp:263-267).
    const nodes = [
      node2D('N', { rotation: Math.PI / 2 }, {
        children: [node('Layer', 'CanvasLayer', { children: [label('L')] })],
      }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const layer = result.current.tree[0]!;
    expect(layer.node.type).toBe('CanvasLayer');
    expect(layer.skippedAncestors).toBeNull();
    expect(layer.children[0]!.skippedAncestors).toBeNull();
  });

  it("carries only the Node2D ancestor's transform, never folding in the Control's OWN `rotation` — that is ControlCanvasWalker's job", async () => {
    const nodes = [
      node2D('N', { position: { x: 100, y: 0 }, rotation: Math.PI / 2 }, {
        children: [control('C', { rotation: Math.PI / 2 })],
      }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const t = result.current.tree[0]!.skippedAncestors!.transform;
    expect(t.a).toBeCloseTo(0, 10);
    expect(t.b).toBeCloseTo(1, 10);
    expect(t.c).toBeCloseTo(-1, 10);
    expect(t.d).toBeCloseTo(0, 10);
    expect(t.tx).toBe(100);
    expect(t.ty).toBe(0);
  });

  it("multiplies a skipped Node2D ancestor's `modulate` componentwise — `_cull_canvas_item`, renderer_canvas_cull.cpp", async () => {
    const outer = node2D('Outer', {}, {
      properties: { modulate: { r: 0.5, g: 1, b: 1, a: 0.5 } },
      children: [
        node2D('Inner', {}, {
          properties: { modulate: { r: 0.5, g: 0.25, b: 1, a: 1 } },
          children: [label('L')],
        }),
      ],
    });
    const { result } = renderHook(() => useBuildSolveTree([outer], [], []));
    expect(result.current.tree[0]!.skippedAncestors!.modulate).toEqual({ r: 0.25, g: 0.25, b: 1, a: 0.5 });
  });

  it("never propagates a skipped ancestor's `self_modulate` — own pixels only, and the Node2D paints none", async () => {
    const nodes = [
      node2D('N', {}, {
        properties: { self_modulate: { r: 0, g: 0, b: 0, a: 0 } },
        children: [label('L')],
      }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree[0]!.skippedAncestors!.modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("collects each skipped ancestor's z STEP, outermost first — `p_z` clamps per item (renderer_canvas_cull.cpp:430-434)", async () => {
    const outer = node2D('Outer', {}, {
      properties: { z_index: 5 },
      children: [
        node2D('Inner', {}, { properties: { z_index: 3, z_as_relative: false }, children: [label('L')] }),
      ],
    });
    const { result } = renderHook(() => useBuildSolveTree([outer], [], []));
    expect(result.current.tree[0]!.skippedAncestors!.z).toEqual([
      { zIndex: 5, zAsRelative: true },
      { zIndex: 3, zAsRelative: false },
    ]);
  });

  it('records a step for an ancestor that authored no z at all, so the chain length matches the walk', async () => {
    const nodes = [node2D('N', { position: { x: 5, y: 5 } }, { children: [label('L')] })];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree[0]!.skippedAncestors!.z).toEqual([{ zIndex: 0, zAsRelative: true }]);
  });

  it('a Control that is never promoted (no skipped ancestor) carries no ancestor transform', async () => {
    const { result } = renderHook(() => useBuildSolveTree([control('C')], [], []));
    expect(result.current.tree[0]!.skippedAncestors).toBeNull();
  });
});

describe('useBuildSolveTree — `parent_visible_in_tree` follows the SCENE tree, not the canvas parenting', () => {
  // `NOTIFICATION_ENTER_TREE` takes the direct parent's `is_visible_in_tree()`
  // (canvas_item.cpp:311-316) with no `top_level` test, unlike `get_parent_item()`
  // (canvas_item.cpp:565-571), and propagation reaches top_level children
  // (canvas_item.cpp:103-108). So visibility crosses breaks that reset the rest.

  it("ANDs a skipped Node2D ancestor's own `visible` — `is_visible_in_tree`, canvas_item.cpp:62-64", () => {
    const nodes = [node2D('N', {}, { children: [label('L')], properties: { visible: false } })];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree[0]!.parentVisibleInTree).toBe(false);
  });

  it('ANDs two chained Node2D ancestors — a hidden OUTER hides through a visible inner', () => {
    const outer = node2D('Outer', {}, {
      properties: { visible: false },
      children: [node2D('Inner', {}, { children: [label('L')] })],
    });
    const { result } = renderHook(() => useBuildSolveTree([outer], [], []));
    expect(result.current.tree[0]!.parentVisibleInTree).toBe(false);
  });

  it('ANDs a hidden CONTROL ancestor the same way — the conjunction is over CanvasItems, not Node2Ds', () => {
    const nodes = [control('Outer', { visible: false }, [label('L')])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree[0]!.children[0]!.parentVisibleInTree).toBe(false);
  });

  it('reaches a `top_level` Control, which `get_parent_item()` would have cut off', () => {
    // `get_parent_item()` opens `if (top_level) return nullptr;`
    // (canvas_item.cpp:565-571), so transform and modulate reset. ENTER_TREE's cast
    // has no such test (canvas_item.cpp:311-316), and propagation steps into a
    // top_level child (canvas_item.cpp:103-108).
    const nodes = [
      control('Root', {}, [
        node2D('N', {}, {
          properties: { visible: false },
          children: [label('Floating', { topLevel: true })],
        }),
      ]),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const floating = result.current.tree.find((n) => n.path === 'Root/N/Floating')!;
    expect(floating.skippedAncestors).toBeNull();
    expect(floating.parentVisibleInTree).toBe(false);
  });

  it('reaches a `top_level` Control directly under a hidden Control', () => {
    const nodes = [control('Root', { visible: false }, [label('Floating', { topLevel: true })])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const floating = result.current.tree.find((n) => n.path === 'Root/Floating')!;
    expect(floating.parentVisibleInTree).toBe(false);
  });

  it('RESETS to true at a non-CanvasItem parent — the Window fallback, canvas_item.cpp:330-350', () => {
    // A plain `Node`/`Node3D` parent fails both the `CanvasItem` and the
    // `CanvasLayer` cast, so the walk climbs to the enclosing `Viewport`: the
    // root `Window`'s own `is_visible()` (true), or plain `true` inside a
    // `SubViewport`. The hidden ancestor above the break never reaches down.
    const nodes = [
      control('Root', { visible: false }, [node('Group', 'Node3D', { children: [label('L')] })]),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const hoisted = result.current.tree.find((n) => n.path === 'Root/Group/L')!;
    expect(hoisted.parentVisibleInTree).toBe(true);
  });

  it("takes a CanvasLayer's OWN `visible`, not its in-tree one — `cl->is_visible()`, canvas_item.cpp:325-329", () => {
    const nodes = [
      control('Root', { visible: false }, [
        node('Layer', 'CanvasLayer', { properties: { name: 'Layer' }, children: [label('L')] }),
      ]),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const layer = result.current.tree[0]!.children[0]!;
    expect(layer.children[0]!.parentVisibleInTree).toBe(true);
  });

  it('a scene root has nothing above it', () => {
    const { result } = renderHook(() => useBuildSolveTree([control('C')], [], []));
    expect(result.current.tree[0]!.parentVisibleInTree).toBe(true);
  });

  it("reads the `visible` a container WROTE, not the authored one", () => {
    // `FoldableContainer::_notification`'s `c->set_visible(!folded)`
    // (foldable_container.cpp:376-386) runs before anything reads the flag, so
    // the page's own subtree inherits the written value.
    const nodes = [
      node('FC', 'FoldableContainer', {
        properties: { name: 'FC', folded: true, title: 'T' } as Record<string, unknown>,
        children: [control('Page', {}, [label('Deep')])],
      }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const page = result.current.tree[0]!.children[0]!;
    expect(page.children[0]!.parentVisibleInTree).toBe(false);
  });
});

describe('useBuildSolveTree — a Control whose CanvasItem chain is broken becomes a canvas root', () => {
  // A non-CanvasItem link ends the climb (control.cpp:3874-3890), so the Control is
  // a viewport root, and `_enter_canvas` (canvas_item.cpp:234-285) parents it at the
  // enclosing canvas. No ancestor transform, modulate or z reaches it, and it
  // anchors against the viewport: a root of this forest.

  it('surfaces a Control separated from its ancestor Control by a plain `Node` as a second root', () => {
    const nodes = [
      control('Root', { anchors_preset: 15 }),
    ];
    (nodes[0] as TscnNode).children = [node('Holder', 'Node', { children: [label('Promoted')] })];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree.map((n) => n.path)).toEqual(['Root', 'Root/Holder/Promoted']);
    expect(result.current.tree[0]!.children).toHaveLength(0);
  });

  it('makes a top_level Control a canvas root even though its parent IS a Control', () => {
    // The climb's own loop condition is `while (!node->is_set_as_top_level())`
    // (control.cpp:3876), so it never starts: `has_parent_control` stays false
    // and the Control registers as a viewport root exactly as a broken chain
    // does.
    const nodes = [control('Root', { anchors_preset: 15 })];
    (nodes[0] as TscnNode).children = [label('Floating', { topLevel: true })];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree.map((n) => n.path)).toEqual(['Root', 'Root/Floating']);
    expect(result.current.tree[0]!.children).toHaveLength(0);
  });

  it('keeps a top_level Control clear of the Node2D ancestors it sits under', () => {
    // `get_parent_item()` returns before the parent cast (canvas_item.cpp:565-571),
    // so the Node2D between them composes onto nothing, unlike for a promoted Control.
    const anchor = node2D('Anchor', { position: { x: 30, y: 40 } }, {
      children: [label('Floating', { topLevel: true })],
    });
    const root = control('Root', { anchors_preset: 15 });
    (root as TscnNode).children = [anchor];

    const { result } = renderHook(() => useBuildSolveTree([root], [], []));
    expect(result.current.tree.map((n) => n.path)).toEqual(['Root', 'Root/Anchor/Floating']);
    expect(result.current.tree[1]!.skippedAncestors).toBeNull();
  });

  it('stops the hoist at the enclosing CanvasLayer, whose canvas the item actually parents to', () => {
    // `_enter_canvas` climbs plain `Node` parents for a CanvasLayer before
    // falling back to the viewport's World2D canvas (canvas_item.cpp:251-267).
    const promoted = node('Holder', 'Node', { children: [label('Promoted')] });
    const panel = control('Panel');
    (panel as TscnNode).children = [promoted];
    const layer = node('Layer', 'CanvasLayer', { children: [panel] });
    const root = control('Root', { anchors_preset: 15 });
    (root as TscnNode).children = [layer];

    const { result } = renderHook(() => useBuildSolveTree([root], [], []));
    expect(result.current.tree.map((n) => n.path)).toEqual(['Root']);
    const solvedLayer = result.current.tree[0]!.children[0]!;
    expect(solvedLayer.node.type).toBe('CanvasLayer');
    expect(solvedLayer.children.map((n) => n.path)).toEqual([
      'Root/Layer/Panel',
      'Root/Layer/Panel/Holder/Promoted',
    ]);
    expect(solvedLayer.children[0]!.children).toHaveLength(0);
  });

  it('keeps the Node2D chain BELOW the break, which is a canvas root of its own', () => {
    const anchor = node2D('Anchor', { position: { x: 30, y: 40 } }, { children: [label('Promoted')] });
    const root = control('Root', { anchors_preset: 15 });
    (root as TscnNode).children = [node('Holder', 'Node', { children: [anchor] })];

    const { result } = renderHook(() => useBuildSolveTree([root], [], []));
    expect(result.current.tree.map((n) => n.path)).toEqual(['Root', 'Root/Holder/Anchor/Promoted']);
    expect(result.current.tree[1]!.skippedAncestors!.transform).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 30, ty: 40 });
  });

  it('draws after the whole subtree of the root it was hoisted out of', () => {
    // A canvas draws its roots by a per-canvas index (canvas_item.cpp:222-232,
    // viewport.cpp:3721-3724) taken in pre-order (canvas_item.cpp:453-466,
    // scene_tree.cpp:333-348, node.cpp:2152-2187), each subtree whole
    // (renderer_canvas_cull.cpp:494-511). So a hoisted Control draws over later siblings.
    const detached = node('Holder', 'Node', { children: [label('Detached')] });
    const nodes = [control('Root', { anchors_preset: 15 })];
    (nodes[0] as TscnNode).children = [detached, label('Later')];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const [root, hoisted] = result.current.tree;
    expect(hoisted!.path).toBe('Root/Holder/Detached');
    const later = root!.children[0]!;
    expect(later.path).toBe('Root/Later');
    expect(hoisted!.paintSequence).toBeGreaterThan(later.paintSequence);
    expect(hoisted!.paintSequence).toBeGreaterThanOrEqual(root!.paintRange.base + root!.paintRange.size);
  });

  it('orders a Control hoisted to a CanvasLayer against THAT layer’s own roots', () => {
    // The layer's counter is `CanvasLayer::get_sort_index()` (canvas_layer.cpp:261-267)
    // over its own roots, in pre-order [First, Detached, Second]: the hoisted item
    // draws over the first child's subtree and under the second's.
    const detached = node('Holder', 'Node', { children: [label('Detached')] });
    const first = control('First');
    (first as TscnNode).children = [detached];
    const second = control('Second');
    const layer = node('Layer', 'CanvasLayer', { children: [first, second] });
    const root = control('Root', { anchors_preset: 15 });
    (root as TscnNode).children = [layer];

    const { result } = renderHook(() => useBuildSolveTree([root], [], []));
    const solvedLayer = result.current.tree[0]!.children[0]!;
    const [solvedFirst, solvedSecond, hoisted] = solvedLayer.children;
    expect(hoisted!.path).toBe('Root/Layer/First/Holder/Detached');
    expect(hoisted!.paintSequence).toBeGreaterThanOrEqual(
      solvedFirst!.paintRange.base + solvedFirst!.paintRange.size
    );
    expect(hoisted!.paintSequence).toBeLessThan(solvedSecond!.paintSequence);
  });

  it('still carries the eye toggle of every ancestor it was hoisted past', () => {
    // The toggle follows the outliner's subtree, and a hoisted node leaves its
    // ancestor's group, so the flag travels on the node. The ancestor's own
    // `visible = false` does not: `_handle_visibility_change` casts direct
    // children only (canvas_item.cpp:92-111).
    const scene = new TscnParser().parse(`[gd_scene format=3]

[node name="Root" type="Control"]
anchors_preset = 15

[node name="Panel" type="Control" parent="."]

[node name="Holder" type="Node" parent="Panel"]

[node name="Promoted" type="ColorRect" parent="Panel/Holder"]
`);
    const loader = createFakeResourceLoader();
    const { result } = renderHook(
      () => useBuildSolveTree(scene.nodes, scene.externalResources, scene.internalResources),
      {
        wrapper: ({ children }) => (
          <ResourceLoaderProvider loader={loader.loader}>
            <SelectionProvider>
              <HiddenSeeder paths={['Root/Panel']} />
              {children}
            </SelectionProvider>
          </ResourceLoaderProvider>
        ),
      }
    );
    const hoisted = result.current.tree[1]!;
    expect(hoisted.path).toBe('Root/Panel/Holder/Promoted');
    expect(hoisted.hidden).toBe(true);
  });
});

const FONT_A: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };

/** An empty `ThemeResource`, overridden per test. */
function theme(overrides: Partial<ThemeResource> = {}): ThemeResource {
  return {
    defaultFont: null,
    defaultFontSize: undefined,
    fonts: {},
    fontSizes: {},
    typeVariations: {},
    properties: {},
    ...overrides,
  };
}

function control(name: string, extra: Record<string, unknown> = {}, children: TscnNode[] = []): TscnNode {
  return node(name, 'Control', { properties: { name, ...extra } as Record<string, unknown>, children });
}

describe('useBuildSolveTree — ExtResource lookups', () => {
  /** Unrelated declarations ahead of `last`, so a scan per lookup would read all of them. */
  function tableEndingIn(last: TscnExternalResource): TscnExternalResource[] {
    const filler = ['a', 'b', 'c', 'd'].map((id) => ({ id, path: `res://${id}.png`, type: 'Texture2D' }));
    return [...filler, last];
  }

  it("reads each ExtResource entry once however many Controls name the same theme", () => {
    const loader = createFakeResourceLoader();
    const shared = theme({ defaultFontSize: 24 });
    loader.themes.seed('res://theme.tres', shared);
    const { table, entryReads } = countedTable(
      tableEndingIn({ id: '1_theme', path: 'res://theme.tres', type: 'Theme' })
    );
    const nodes = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) =>
      control(name, { theme: 'ExtResource("1_theme")' })
    );

    const { result } = renderHook(() => useBuildSolveTree(nodes, table, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree.map((n) => n.themeChain?.[0])).toEqual(nodes.map(() => shared));
    expect(entryReads()).toBe(table.length);
  });

  it('reads each ExtResource entry once however many instances wait on one scene', () => {
    const loader = createFakeResourceLoader();
    const { table, entryReads } = countedTable(
      tableEndingIn({ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' })
    );
    const nodes = ['A', 'B', 'C', 'D'].map((name) => instanceOf(name, '1_layer'));

    renderHook(() => useBuildSolveTree(nodes, table, []), { wrapper: wrapperFor(loader.loader) });

    expect(loader.scenes.cache.has(LAYER_PATH)).toBe(false);
    expect(entryReads()).toBe(table.length);
  });
});

describe('useBuildSolveTree — theme resolution', () => {
  it("resolves a root Control's theme = ExtResource(...) and threads it to a themeless child's themeChain[0] — the corpus's dominant shape", () => {
    // A node-local read finds nothing for a themed root over plain Labels. Only
    // the ancestor chain does.
    const loader = createFakeResourceLoader();
    const rootTheme = theme({ defaultFontSize: 24 });
    loader.themes.seed('res://theme.tres', rootTheme);

    const nodes = [control('Root', { theme: 'ExtResource("1_theme")' })];
    (nodes[0] as TscnNode).children = [label('Child')];
    const externalResources = [{ id: '1_theme', path: 'res://theme.tres', type: 'Theme' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    const root = result.current.tree.find((n) => n.path === 'Root')!;
    expect(root.themeChain).toEqual([rootTheme]);
    const child = root.children.find((c) => c.path === 'Root/Child')!;
    expect(child.themeChain).toEqual([rootTheme]);
    expect(child.themeChain?.[0]).toBe(rootTheme);
  });

  it('resolves a root Control theme = SubResource(...) — an inline Theme, the 4-file corpus shape', () => {
    const loader = createFakeResourceLoader();
    const fontPath = 'res://fonts/base.ttf';
    loader.fonts.seed(fontPath, FONT_A);

    const nodes = [control('Root', { theme: 'SubResource("5")' })];
    (nodes[0] as TscnNode).children = [label('Child')];
    const internalResources: TscnInternalResource[] = [
      { id: '5', type: 'Theme', data: { default_font: 'ExtResource("1")', default_font_size: '20' } },
    ];
    const externalResources = [{ id: '1', path: fontPath, type: 'FontFile' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, internalResources), {
      wrapper: wrapperFor(loader.loader),
    });

    const root = result.current.tree.find((n) => n.path === 'Root')!;
    expect(root.themeChain).toHaveLength(1);
    expect(root.themeChain?.[0]?.defaultFont).toBe(FONT_A);
    expect(root.themeChain?.[0]?.defaultFontSize).toBe(20);
  });

  it('the nearest ancestor theme is index 0, a farther one comes after it', () => {
    const loader = createFakeResourceLoader();
    const outer = theme({ defaultFontSize: 10 });
    const inner = theme({ defaultFontSize: 20 });
    loader.themes.seed('res://outer.tres', outer);
    loader.themes.seed('res://inner.tres', inner);

    const nodes = [control('Outer', { theme: 'ExtResource("1_outer")' })];
    (nodes[0] as TscnNode).children = [control('Inner', { theme: 'ExtResource("1_inner")' })];
    ((nodes[0] as TscnNode).children[0] as TscnNode).children = [label('Leaf')];
    const externalResources = [
      { id: '1_outer', path: 'res://outer.tres', type: 'Theme' },
      { id: '1_inner', path: 'res://inner.tres', type: 'Theme' },
    ];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    const outerNode = result.current.tree.find((n) => n.path === 'Outer')!;
    const innerNode = outerNode.children.find((c) => c.path === 'Outer/Inner')!;
    const leaf = innerNode.children.find((c) => c.path === 'Outer/Inner/Leaf')!;
    expect(leaf.themeChain).toEqual([inner, outer]);
  });

  it('theme inheritance BREAKS at a non-Control ancestor (Node3D), matching ThemeOwner::propagate_theme_changed', () => {
    const loader = createFakeResourceLoader();
    loader.themes.seed('res://theme.tres', theme({ defaultFontSize: 24 }));

    const nodes = [control('Root', { theme: 'ExtResource("1_theme")' })];
    (nodes[0] as TscnNode).children = [node('Bridge', 'Node3D', { children: [label('Leaf')] })];
    const externalResources = [{ id: '1_theme', path: 'res://theme.tres', type: 'Theme' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    // 'Bridge' (Node3D) is neither a Control nor a CanvasItem, so its Control
    // descendant is a canvas root, with an empty theme chain.
    const leaf = result.current.tree.find((n) => n.path === 'Root/Bridge/Leaf')!;
    expect(leaf.themeChain).toEqual([]);
  });

  it("resolves a node-local theme_override_fonts/<name> ref through the font cache, keyed regardless of the theme's key names", () => {
    const loader = createFakeResourceLoader();
    const fontPath = 'res://fonts/bold.ttf';
    loader.fonts.seed(fontPath, FONT_A);

    const nodes = [label('Title', { themeOverrideFonts: { font: 'ExtResource("1_font")' } })];
    const externalResources = [{ id: '1_font', path: fontPath, type: 'FontFile' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.fontOverrides).toEqual({ font: FONT_A });
  });

  it('an override key stays PRESENT (value null) while its font is still pending — presence, not the resolved value, encodes "authored"', () => {
    const loader = createFakeResourceLoader();
    const nodes = [label('Title', { themeOverrideFonts: { font: 'ExtResource("1_font")' } })];
    const externalResources = [{ id: '1_font', path: 'res://fonts/bold.ttf', type: 'FontFile' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.fontOverrides).toEqual({ font: null });
    expect('font' in (result.current.tree[0]?.fontOverrides ?? {})).toBe(true);
  });

  it('generation bumps and the theme chain updates once a not-yet-cached theme arrives — pendingThemes is requested in the post-render effect, not during the walk', async () => {
    const loader = createFakeResourceLoader();
    const nodes = [control('Root', { theme: 'ExtResource("1_theme")' })];
    const externalResources = [{ id: '1_theme', path: 'res://theme.tres', type: 'Theme' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    const initialGeneration = result.current.generation;
    // Cold cache: the walk never blocks on the load, so the root Control still
    // gets a SolveNode, with an empty theme chain for now.
    expect(result.current.tree[0]?.themeChain).toEqual([]);
    // The request happens in the post-render effect, not in the walk: nothing
    // resolves until `_resolve` is called.
    expect(loader.themes.cache.has('res://theme.tres')).toBe(false);

    const resolved = theme({ defaultFontSize: 24 });
    await act(async () => {
      loader.themes._resolve('res://theme.tres', resolved);
    });

    expect(result.current.generation).toBeGreaterThan(initialGeneration);
    expect(result.current.tree[0]?.themeChain).toEqual([resolved]);
  });

  it('generation bumps once a not-yet-cached font arrives, for a theme_override_fonts ref', async () => {
    const loader = createFakeResourceLoader();
    const fontPath = 'res://fonts/bold.ttf';
    const nodes = [label('Title', { themeOverrideFonts: { font: 'ExtResource("1_font")' } })];
    const externalResources = [{ id: '1_font', path: fontPath, type: 'FontFile' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    const initialGeneration = result.current.generation;
    expect(result.current.tree[0]?.fontOverrides).toEqual({ font: null });

    await act(async () => {
      loader.fonts._resolve(fontPath, FONT_A);
    });

    expect(result.current.generation).toBeGreaterThan(initialGeneration);
    expect(result.current.tree[0]?.fontOverrides).toEqual({ font: FONT_A });
  });

  it('generation bumps once a runtime scene-font metrics load settles (text/sceneFontLoader.ts, not the loader.eventBus)', async () => {
    const loader = createFakeResourceLoader();
    const nodes = [label('Title')];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []), {
      wrapper: wrapperFor(loader.loader),
    });

    const initialGeneration = result.current.generation;

    await act(async () => {
      // `peekSceneFontMetrics`'s async pipeline, started from the solve itself,
      // outside `loader` and its event bus.
      await resolveSceneFontMetrics(
        { kind: 'file', bytes: new ArrayBuffer(4), mimeType: 'font/ttf', fallbacks: [], properties: {} },
        'Root/Title'
      );
    });

    expect(result.current.generation).toBeGreaterThan(initialGeneration);
  });

  it('subscribes to scene-font metrics settlement even with no ResourceLoaderProvider mounted', async () => {
    const nodes = [label('Title')];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));

    const initialGeneration = result.current.generation;

    await act(async () => {
      await resolveSceneFontMetrics(
        { kind: 'file', bytes: new ArrayBuffer(4), mimeType: 'font/ttf', fallbacks: [], properties: {} },
        'Root/Title'
      );
    });

    expect(result.current.generation).toBeGreaterThan(initialGeneration);
  });

  it("wires the project's default theme (gui/theme/custom) as the final rung of a themeless Control's chain", async () => {
    // End to end through the real ResourceLoader: project.godot through
    // FileEventBus.tryLoad (ProjectSettingsContext), and the Theme .tres through
    // the real Theme processor.
    const projectGodot = [
      'config_version=5',
      '',
      '[gui]',
      '',
      'theme/custom="res://project_theme.tres"',
      '',
    ].join('\n');
    const themeTres = [
      '[gd_resource type="Theme" load_steps=1 format=3]',
      '',
      '[resource]',
      'default_font_size = 30',
      '',
    ].join('\n');
    const files: Record<string, string> = {
      'res://project.godot': projectGodot,
      'res://project_theme.tres': themeTres,
    };
    const provider: ResourceProvider = {
      async loadResource(path: string) {
        const content = files[path];
        if (content === undefined) throw new Error(`Resource not found: ${path}`);
        return content;
      },
    };
    const bus = new FileEventBus(provider);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);

    const nodes = [label('Plain')];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={loader}>
          <ProjectSettingsProvider sceneKey="res://scene.tscn">{children}</ProjectSettingsProvider>
        </ResourceLoaderProvider>
      ),
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.tree[0]?.projectTheme?.defaultFontSize).toBe(30);
  });
});

describe('useBuildSolveTree — theme StyleBox/Color/Constant resolution', () => {
  it("a themed widget picks the ancestor Theme's StyleBox over nothing, when it authors no local override", () => {
    const loader = createFakeResourceLoader();
    const flatBox: TscnInternalResource = { id: 'flat1', type: 'StyleBoxFlat', data: { bg_color: 'Color(1, 0, 0, 1)' } };
    loader.themes.seed(
      'res://theme.tres',
      theme({
        styles: { Panel: { panel: 'SubResource("flat1")' } },
        resources: { externalResources: [], internalResources: [flatBox] },
      })
    );

    const nodes = [node('Root', 'Panel', { properties: { name: 'Root', theme: 'ExtResource("1_theme")' } })];
    const externalResources = [{ id: '1_theme', path: 'res://theme.tres', type: 'Theme' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.styleBoxes.panel?.bgColor).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('a local theme_override_styles/* still beats both the ancestor Theme and the local override on a farther ancestor', () => {
    const loader = createFakeResourceLoader();
    const themedBox: TscnInternalResource = { id: 'flat1', type: 'StyleBoxFlat', data: { bg_color: 'Color(1, 0, 0, 1)' } };
    const localBox: TscnInternalResource = { id: 'flat2', type: 'StyleBoxFlat', data: { bg_color: 'Color(0, 1, 0, 1)' } };
    loader.themes.seed(
      'res://theme.tres',
      theme({
        styles: { Panel: { panel: 'SubResource("flat1")' } },
        resources: { externalResources: [], internalResources: [themedBox] },
      })
    );

    const nodes = [
      node('Root', 'Panel', {
        properties: {
          name: 'Root',
          theme: 'ExtResource("1_theme")',
          themeOverrideStyles: { panel: 'SubResource("flat2")' },
        } as Record<string, unknown>,
      }),
    ];
    const externalResources = [{ id: '1_theme', path: 'res://theme.tres', type: 'Theme' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, [localBox]), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.styleBoxes.panel?.bgColor).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });

  it("a themed widget's descendant resolves a Theme colour through the SAME ancestor chain, and a local theme_override_colors/* still wins", () => {
    const loader = createFakeResourceLoader();
    loader.themes.seed(
      'res://theme.tres',
      theme({ colors: { Panel: { font_color: { r: 0, g: 0, b: 1, a: 1 } } } })
    );

    const nodes = [node('Root', 'Panel', { properties: { name: 'Root', theme: 'ExtResource("1_theme")' } })];
    (nodes[0] as TscnNode).children = [
      node('Child', 'Panel', {
        properties: { name: 'Child', themeOverrideColors: { font_color: { r: 1, g: 1, b: 1, a: 1 } } } as Record<
          string,
          unknown
        >,
      }),
    ];
    const externalResources = [{ id: '1_theme', path: 'res://theme.tres', type: 'Theme' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    const root = result.current.tree.find((n) => n.path === 'Root')!;
    const child = root.children.find((c) => c.path === 'Root/Child')!;
    expect(root.colors.font_color).toEqual({ r: 0, g: 0, b: 1, a: 1 });
    expect(child.colors.font_color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('an empty ancestor Theme contributes nothing, and a Theme constant reaches SolveNode.constants unscaled from the PROJECT theme', async () => {
    const projectGodot = ['config_version=5', '', '[gui]', '', 'theme/custom="res://project_theme.tres"', ''].join(
      '\n'
    );
    const themeTres = [
      '[gd_resource type="Theme" load_steps=1 format=3]',
      '',
      '[resource]',
      'Panel/constants/h_separation = 8',
      '',
    ].join('\n');
    const files: Record<string, string> = {
      'res://project.godot': projectGodot,
      'res://project_theme.tres': themeTres,
    };
    const provider: ResourceProvider = {
      async loadResource(path: string) {
        const content = files[path];
        if (content === undefined) throw new Error(`Resource not found: ${path}`);
        return content;
      },
    };
    const bus = new FileEventBus(provider);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);

    const nodes = [node('Root', 'Panel', { properties: { name: 'Root' } })];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={loader}>
          <ProjectSettingsProvider sceneKey="res://scene.tscn">{children}</ProjectSettingsProvider>
        </ResourceLoaderProvider>
      ),
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Unscaled: the literal `8` the project theme's `.tres` declares.
    expect(result.current.tree[0]?.constants.h_separation).toBe(8);
  });
});

/**
 * An inline procedural texture's minimum size, from `.tscn` text to a solved rect.
 * Expected positions are Godot 4.6.3's renders of
 * `scenes/fixtures/unit-texturerect-gradienttexture.tscn` and
 * `unit-button-icon-gradienttexture.tscn` at 1152x648.
 */
describe('useBuildSolveTree — an inline procedural texture moves the solved rect', () => {
  const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };

  function solveTscn(tscn: string): ReadonlyMap<string, SolvedControl> {
    const scene = new TscnParser().parse(tscn);
    const loader = createFakeResourceLoader();
    const { result } = renderHook(
      () => useBuildSolveTree(scene.nodes, scene.externalResources, scene.internalResources),
      { wrapper: wrapperFor(loader.loader) }
    );
    return solveControlTree(result.current.tree, VIEWPORT, createSolveContext(nativeTheme(1)));
  }

  /**
   * A solved rect is PARENT-relative; Godot's probe coordinates are viewport
   * coordinates. The column is the only container between the two here, so
   * adding its own top is the whole conversion.
   */
  function absoluteTop(solved: ReadonlyMap<string, SolvedControl>, path: string): number {
    return (solved.get('Root/Column')?.rect.y ?? NaN) + (solved.get(path)?.rect.y ?? NaN);
  }

  it('gives a TextureRect the gradient\'s 160 px height and pushes its sibling to y = 288', () => {
    const solved = solveTscn(`[gd_scene load_steps=3 format=3]

[sub_resource type="Gradient" id="Gradient_ramp"]
offsets = PackedFloat32Array(0, 1)
colors = PackedColorArray(0.9, 0.2, 0.2, 1, 0.2, 0.2, 0.9, 1)

[sub_resource type="GradientTexture2D" id="GradientTexture2D_ramp"]
gradient = SubResource("Gradient_ramp")
width = 160
height = 160

[node name="Root" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="Column" type="VBoxContainer" parent="."]
offset_left = 100.0
offset_top = 80.0
offset_right = 420.0
offset_bottom = 600.0

[node name="Above" type="ColorRect" parent="Column"]
custom_minimum_size = Vector2(0, 40)
color = Color(0.15, 0.6, 0.3, 1)

[node name="InlineGradient" type="TextureRect" parent="Column"]
texture = SubResource("GradientTexture2D_ramp")

[node name="Below" type="ColorRect" parent="Column"]
custom_minimum_size = Vector2(0, 40)
color = Color(0.95, 0.85, 0.1, 1)
`);

    // 80 (column top) + 40 (Above) + 4 (separation) = 124, then 160 of texture.
    expect(solved.get('Root/Column/InlineGradient')?.rect.h).toBe(160);
    expect(absoluteTop(solved, 'Root/Column/InlineGradient')).toBe(124);
    // Godot paints the yellow `Below` rect at (110, 300); an unresolved
    // texture would leave it at y = 128 and that probe would read the
    // viewport background instead.
    expect(solved.get('Root/Column/Below')?.rect.h).toBe(40);
    expect(absoluteTop(solved, 'Root/Column/Below')).toBe(288);
  });

  it("gives a Button the icon's 96 px plus its content margins and pushes its sibling to y = 196", () => {
    const solved = solveTscn(`[gd_scene load_steps=4 format=3]

[sub_resource type="StyleBoxFlat" id="StyleBoxFlat_button"]
bg_color = Color(0.2, 0.5, 0.35, 1)
content_margin_left = 10.0
content_margin_top = 8.0
content_margin_right = 10.0
content_margin_bottom = 8.0

[sub_resource type="Gradient" id="Gradient_icon"]
offsets = PackedFloat32Array(0, 1)
colors = PackedColorArray(1, 0.85, 0.2, 1, 0.8, 0.1, 0.1, 1)

[sub_resource type="GradientTexture2D" id="GradientTexture2D_icon"]
gradient = SubResource("Gradient_icon")
width = 96
height = 96
fill = 1
fill_from = Vector2(0.5, 0.5)
fill_to = Vector2(1, 0.5)

[node name="Root" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="Column" type="VBoxContainer" parent="."]
offset_left = 100.0
offset_top = 80.0
offset_right = 460.0
offset_bottom = 600.0

[node name="IconButton" type="Button" parent="Column"]
theme_override_styles/normal = SubResource("StyleBoxFlat_button")
theme_override_styles/hover = SubResource("StyleBoxFlat_button")
theme_override_styles/pressed = SubResource("StyleBoxFlat_button")
theme_override_styles/focus = SubResource("StyleBoxFlat_button")
icon = SubResource("GradientTexture2D_icon")

[node name="Below" type="ColorRect" parent="Column"]
custom_minimum_size = Vector2(0, 40)
color = Color(0.95, 0.85, 0.1, 1)
`);

    // 96 icon + 8 top + 8 bottom content margin = 112.
    expect(solved.get('Root/Column/IconButton')?.rect.h).toBe(112);
    expect(absoluteTop(solved, 'Root/Column/IconButton')).toBe(80);
    // Godot paints the yellow `Below` rect at (110, 215); with no icon size the
    // Button would be 16 px tall and `Below` would start at y = 100.
    expect(solved.get('Root/Column/Below')?.rect.h).toBe(40);
    expect(absoluteTop(solved, 'Root/Column/Below')).toBe(196);
  });
});

/**
 * The eye toggle (`SelectionContext.hiddenNodePaths`) stands in for clearing
 * `visible`, so it reaches the solve: `Container::_sort_children` leaves no slot
 * for a rejected child (`scene/gui/container.cpp::Container::_sort_children`). A
 * hidden group alone would paint a hole.
 */
describe('useBuildSolveTree — hiddenNodePaths reaches the solve', () => {
  const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };

  const COLUMN = `[gd_scene format=3]

[node name="Root" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="Column" type="VBoxContainer" parent="."]
offset_right = 320.0
offset_bottom = 600.0

[node name="First" type="ColorRect" parent="Column"]
custom_minimum_size = Vector2(0, 40)

[node name="Second" type="ColorRect" parent="Column"]
custom_minimum_size = Vector2(0, 40)

[node name="Third" type="ColorRect" parent="Column"]
custom_minimum_size = Vector2(0, 40)
`;

  function solveWithHidden(hidden: readonly string[]): ReadonlyMap<string, SolvedControl> {
    const scene = new TscnParser().parse(COLUMN);
    const loader = createFakeResourceLoader();
    const { result } = renderHook(
      () => useBuildSolveTree(scene.nodes, scene.externalResources, scene.internalResources),
      {
        wrapper: ({ children }) => (
          <ResourceLoaderProvider loader={loader.loader}>
            <SelectionProvider>
              <HiddenSeeder paths={hidden} />
              {children}
            </SelectionProvider>
          </ResourceLoaderProvider>
        ),
      }
    );
    return solveControlTree(result.current.tree, VIEWPORT, createSolveContext(nativeTheme(1)));
  }

  it('stamps `hidden` on the matching node and on nothing else', () => {
    const scene = new TscnParser().parse(COLUMN);
    const loader = createFakeResourceLoader();
    const { result } = renderHook(
      () => useBuildSolveTree(scene.nodes, scene.externalResources, scene.internalResources),
      {
        wrapper: ({ children }) => (
          <ResourceLoaderProvider loader={loader.loader}>
            <SelectionProvider>
              <HiddenSeeder paths={['Root/Column/Second']} />
              {children}
            </SelectionProvider>
          </ResourceLoaderProvider>
        ),
      }
    );
    const column = result.current.tree[0]!.children[0]!;
    expect(column.children.map((c) => c.hidden)).toEqual([false, true, false]);
  });

  it('hides a promoted Control when the SKIPPED node the eye toggle names is its ancestor', () => {
    // A Node2D leaves no SolveNode, and its Control descendants promote past it,
    // so an own-path stamp would let them escape a whole-subtree toggle.
    const scene = new TscnParser().parse(`[gd_scene format=3]

[node name="Root" type="Control"]
anchors_preset = 15

[node name="Holder" type="Node2D" parent="."]

[node name="Promoted" type="ColorRect" parent="Holder"]
`);
    const loader = createFakeResourceLoader();
    const { result } = renderHook(
      () => useBuildSolveTree(scene.nodes, scene.externalResources, scene.internalResources),
      {
        wrapper: ({ children }) => (
          <ResourceLoaderProvider loader={loader.loader}>
            <SelectionProvider>
              <HiddenSeeder paths={['Root/Holder']} />
              {children}
            </SelectionProvider>
          </ResourceLoaderProvider>
        ),
      }
    );
    const promoted = result.current.tree[0]!.children[0]!;
    expect(promoted.path).toBe('Root/Holder/Promoted');
    expect(promoted.hidden).toBe(true);
  });

  it('closes the gap a hidden child leaves, rather than laying out an empty slot', () => {
    // `default_theme.cpp`'s BoxContainer `separation` is 4, so three 40 px rows
    // sit at 0 / 44 / 88.
    const all = solveWithHidden([]);
    expect(all.get('Root/Column/Third')?.rect.y).toBe(88);

    const hidden = solveWithHidden(['Root/Column/Second']);
    expect(hidden.get('Root/Column/Third')?.rect.y).toBe(44);
    expect(hidden.get('Root/Column/First')?.rect.y).toBe(0);
  });
});

// Only the Control walk registers this scene. `createSceneProcessor` throws
// "Scene metadata not found" for an unregistered address and caches the
// failure, so the registration must precede the request.
describe('useBuildSolveTree — requesting an uncached sub-scene', () => {
  it('registers the ExtResource before it asks the loader for the scene', () => {
    const loader = createFakeResourceLoader();
    const order: string[] = [];
    loader.scenes.setRequestImpl((path) => order.push(`request:${path}`));

    const ext = { id: '1_layer', path: LAYER_PATH, type: 'PackedScene' };
    renderHook(() => useBuildSolveTree([instanceOf('Hud', '1_layer')], [ext], []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(loader.registerCalls).toContainEqual(ext);
    expect(order).toContain(`request:${LAYER_PATH}`);
    // `registerCalls` is in call order and the request impl only records after
    // it runs, so a registration recorded at all means it ran first.
    expect(loader.registerCalls.findIndex((r) => r.path === LAYER_PATH)).toBeGreaterThanOrEqual(0);
  });

  it('requests a raw `res://` instance, which names no ExtResource to register', () => {
    const loader = createFakeResourceLoader();
    const requested: string[] = [];
    loader.scenes.setRequestImpl((path) => requested.push(path));

    renderHook(
      () => useBuildSolveTree([node('Hud', 'Node', { instance: LAYER_PATH })], [], []),
      { wrapper: wrapperFor(loader.loader) }
    );

    expect(requested).toContain(LAYER_PATH);
    expect(loader.registerCalls).toHaveLength(0);
  });

  it('keeps the ExtResource when the same path is also reached raw', () => {
    const loader = createFakeResourceLoader();
    loader.scenes.setRequestImpl(() => {});

    const ext = { id: '1_layer', path: LAYER_PATH, type: 'PackedScene' };
    renderHook(
      () =>
        useBuildSolveTree(
          [node('Hud', 'Node', { instance: LAYER_PATH }), instanceOf('Hud2', '1_layer')],
          [ext],
          []
        ),
      { wrapper: wrapperFor(loader.loader) }
    );

    // The raw node is walked FIRST; its absent ExtResource must not be the one
    // the single per-path entry keeps, or the registration never happens.
    expect(loader.registerCalls).toContainEqual(ext);
  });

  it('does not re-request a scene the loader already has', () => {
    const loader = createFakeResourceLoader();
    loader.scenes.seed(LAYER_PATH, scene([label('LayerLabel', { text: 'HUD LAYER' })]));
    const requested: string[] = [];
    loader.scenes.setRequestImpl((path) => requested.push(path));

    renderHook(
      () => useBuildSolveTree([instanceOf('Hud', '1_layer')], [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }], []),
      { wrapper: wrapperFor(loader.loader) }
    );

    expect(requested).not.toContain(LAYER_PATH);
  });
});

describe('useBuildSolveTree — per-type texture slots (registerTextureSlots)', () => {
  it("populates a TextureProgressBar's textureSlots from texture_under/texture_progress, keyed by their own Godot property names", () => {
    const loader = createFakeResourceLoader();
    const underPath = 'res://under.png';
    const progressPath = 'res://progress.png';
    loader.textures.seed(underPath, { image: { width: 40, height: 12 } } as unknown as THREE.Texture);
    loader.textures.seed(progressPath, { image: { width: 20, height: 30 } } as unknown as THREE.Texture);

    const nodes = [
      node('Bar', 'TextureProgressBar', {
        properties: {
          name: 'Bar',
          textureUnder: 'ExtResource("1")',
          textureProgress: 'ExtResource("2")',
        },
      }),
    ];
    const externalResources = [
      { id: '1', path: underPath, type: 'Texture2D' },
      { id: '2', path: progressPath, type: 'Texture2D' },
    ];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.textureSlots).toEqual({
      texture_under: { x: 40, y: 12 },
      texture_progress: { x: 20, y: 30 },
    });
  });

  it("populates a TextureButton's textureSlots from texture_normal only, when that is the sole authored slot", () => {
    const loader = createFakeResourceLoader();
    const normalPath = 'res://normal.png';
    loader.textures.seed(normalPath, { image: { width: 64, height: 24 } } as unknown as THREE.Texture);

    const nodes = [
      node('Btn', 'TextureButton', { properties: { name: 'Btn', textureNormal: 'ExtResource("1")' } }),
    ];
    const externalResources = [{ id: '1', path: normalPath, type: 'Texture2D' }];

    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.textureSlots).toEqual({ texture_normal: { x: 64, y: 24 } });
  });

  it("resolves a RichTextLabel's [img] natural size onto textureSlots, keyed by the ref itself", () => {
    const loader = createFakeResourceLoader();
    const imgPath = 'res://logo.png';
    loader.textures.seed(imgPath, { image: { width: 48, height: 24 } } as unknown as THREE.Texture);

    const nodes = [
      node('Label', 'RichTextLabel', {
        properties: { name: 'Label', text: `[img]${imgPath}[/img]`, bbcodeEnabled: true },
      }),
    ];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []), {
      wrapper: wrapperFor(loader.loader),
    });

    expect(result.current.tree[0]?.textureSlots).toEqual({ [imgPath]: { x: 48, y: 24 } });
  });

  it(
    "resolves an ExtResource(AtlasTexture) '.tres' slot's own region size through the RESOURCE bus — " +
      'the generic single-slot fallback (TextureRect\'s `texture`) shares the same per-ref resolution registered types do',
    async () => {
      const loader = createFakeResourceLoader();
      const tresPath = 'res://icons/keyboard_arrow_left.tres';
      // A real AtlasTexture `.tres`, through the actual parser, as in
      // `useTexture2D.test.tsx`.
      const atlasTres: ParsedResource = parseTresFile(`[gd_resource type="AtlasTexture" format=3]

[ext_resource type="Texture2D" path="res://sheet.png" id="1_tk63f"]

[resource]
atlas = ExtResource("1_tk63f")
region = Rect2(32, 32, 64, 64)
`);

      const nodes = [
        node('Portrait', 'TextureRect', { properties: { name: 'Portrait', texture: 'ExtResource("1_atlas")' } }),
      ];
      const externalResources = [{ id: '1_atlas', path: tresPath, type: 'AtlasTexture' }];

      const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
        wrapper: wrapperFor(loader.loader),
      });

      expect(result.current.tree[0]?.textureSize).toBeNull();
      const initialGeneration = result.current.generation;

      await act(async () => {
        loader.resources._resolve(tresPath, atlasTres);
      });

      // The resource bus, not the texture one: the `.tres` is a region in
      // text, not pixels.
      expect(result.current.generation).toBeGreaterThan(initialGeneration);
      expect(result.current.tree[0]?.textureSize).toEqual({ x: 64, y: 64 });
    }
  );
});

/**
 * `Control::is_layout_rtl()` (`scene/gui/control.cpp:3551-3620`) resolved once
 * per node, on the walk that can still see the scene tree: the INHERITED climb
 * (`:3584-3593`) steps over every ancestor that is neither a Control nor a
 * Window, which the Control-only solve tree no longer knows about.
 */
describe('useBuildSolveTree — layout direction', () => {
  it('resolves an explicit RTL, and an explicit LTR beneath it', () => {
    // `data.is_rtl = (data.layout_dir == LAYOUT_DIRECTION_RTL);` (`control.cpp:3619`).
    const nodes = [
      node('Rtl', 'Control', {
        properties: { name: 'Rtl', layoutDirection: 3 } as Record<string, unknown>,
        children: [
          label('Inherited'),
          node('Ltr', 'Control', {
            properties: { name: 'Ltr', layoutDirection: 2 } as Record<string, unknown>,
            children: [label('UnderLtr')],
          }),
        ],
      }),
    ];

    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const root = result.current.tree[0]!;
    expect(root.rtl).toBe(true);
    expect(root.children[0]!.rtl).toBe(true);
    expect(root.children[1]!.rtl).toBe(false);
    expect(root.children[1]!.children[0]!.rtl).toBe(false);
  });

  it('a root Control with no ancestor is left-to-right without a project file', () => {
    // The climb runs off the top and `root_layout_direction` decides
    // (`control.cpp:3600-3608`); its default is 0 and the locale is not RTL.
    const { result } = renderHook(() => useBuildSolveTree([label('Lone')], [], []));
    expect(result.current.tree[0]!.rtl).toBe(false);
  });

  it('climbs PAST a non-Control ancestor, which ends no chain', () => {
    // The loop only stops at `Object::cast_to<Control>` or `<Window>`
    // (`control.cpp:3586-3592`); a Node2D between them is simply stepped over,
    // even though it breaks this codebase's own Control parenting.
    const nodes = [
      node('Rtl', 'Control', {
        properties: { name: 'Rtl', layoutDirection: 3 } as Record<string, unknown>,
        children: [node2D('Mid', { position: { x: 10, y: 0 } }, { children: [label('Deep')] })],
      }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    expect(result.current.tree[0]!.children[0]!.rtl).toBe(true);
  });

  it('honours `root_node_layout_direction = 2` for an INHERITED root', async () => {
    // `proj_root_layout_direction == 2` => RTL (`control.cpp:3602-3603`), seeded
    // into the static by `scene/register_scene_types.cpp:568-570`.
    const files: Record<string, string> = {
      'res://project.godot': [
        'config_version=5',
        '',
        '[internationalization]',
        '',
        'rendering/root_node_layout_direction=2',
        '',
      ].join('\n'),
    };
    const provider: ResourceProvider = {
      async loadResource(path: string) {
        const content = files[path];
        if (content === undefined) throw new Error(`Resource not found: ${path}`);
        return content;
      },
    };
    const bus = new FileEventBus(provider);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);

    const { result } = renderHook(() => useBuildSolveTree([label('Lone')], [], []), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={loader}>
          <ProjectSettingsProvider sceneKey="res://scene.tscn">{children}</ProjectSettingsProvider>
        </ResourceLoaderProvider>
      ),
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.tree[0]!.rtl).toBe(true);
  });

  it('starts the forest from an INHERITED direction the caller climbed to for it', () => {
    // The climb casts to `Control`, then `Window`, then goes on
    // (`control.cpp:3584-3598`), stepping over a `SubViewport`. This walk cannot
    // see the container above it, so the caller states it.
    const nodes = [
      node('Box', 'HBoxContainer', {
        properties: { name: 'Box' } as Record<string, unknown>,
        children: [label('Inherited')],
      }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], [], true));
    expect(result.current.tree[0]!.rtl).toBe(true);
    expect(result.current.tree[0]!.children[0]!.rtl).toBe(true);
  });

  it('lets an explicit direction below the inherited one still win', () => {
    // `data.layout_dir != LAYOUT_DIRECTION_INHERITED` never reaches the climb
    // at all (`control.cpp:3555`).
    const nodes = [
      node('Ltr', 'Control', {
        properties: { name: 'Ltr', layoutDirection: 2 } as Record<string, unknown>,
        children: [label('UnderLtr')],
      }),
    ];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], [], true));
    expect(result.current.tree[0]!.rtl).toBe(false);
    expect(result.current.tree[0]!.children[0]!.rtl).toBe(false);
  });
});

describe('useBuildSolveTree — a container that writes its children’s `visible`', () => {
  // `FoldableContainer::_notification`'s NOTIFICATION_SORT_CHILDREN runs
  // `c->set_visible(!folded)` on every direct child `as_sortable_control`
  // accepts in IGNORE mode (`scene/gui/foldable_container.cpp:376-386`), so the
  // authored flag is overwritten in BOTH directions before anything reads it.
  function foldable(name: string, folded: boolean, children: TscnNode[]): TscnNode {
    return node(name, 'FoldableContainer', {
      properties: { name, folded, title: 'T' } as Record<string, unknown>,
      children,
    });
  }

  it('clears a folded container’s direct Control child (foldable_container.cpp:381)', () => {
    const nodes = [foldable('FC', true, [label('Contents', { text: 'Sword' })])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const child = result.current.tree[0]!.children[0]!;
    expect((child.node.properties as { visible?: boolean }).visible).toBe(false);
  });

  it('SETS an unfolded container’s child visible, overriding an authored `visible = false`', () => {
    const nodes = [foldable('FC', false, [label('Contents', { text: 'Volume', visible: false })])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const child = result.current.tree[0]!.children[0]!;
    expect((child.node.properties as { visible?: boolean }).visible).toBe(true);
  });

  it('leaves a grandchild promoted past a Node2D alone — `cast_to<Control>` never sees it (container.cpp:144)', () => {
    const nodes = [foldable('FC', true, [node2D('N', {}, { children: [label('Promoted')] })])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const promoted = result.current.tree[0]!.children[0]!;
    expect(promoted.path).toBe('FC/N/Promoted');
    expect((promoted.node.properties as { visible?: boolean }).visible).toBeUndefined();
  });

  it('leaves a top_level child alone — `is_set_as_top_level()` is checked first (container.cpp:145)', () => {
    const nodes = [foldable('FC', true, [label('Floating', { topLevel: true })])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const floating = result.current.tree.find((n) => n.path === 'FC/Floating')!;
    expect((floating.node.properties as { visible?: boolean }).visible).toBeUndefined();
  });

  it('leaves a CanvasLayer child alone — `cast_to<Control>` fails on a plain Node (container.cpp:144)', () => {
    const nodes = [foldable('FC', true, [node('Layer', 'CanvasLayer', { properties: { name: 'Layer' } })])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
    const layer = result.current.tree[0]!.children[0]!;
    expect(layer.node.type).toBe('CanvasLayer');
    expect((layer.node.properties as { visible?: boolean }).visible).toBeUndefined();
  });

  it('never un-hides a child the outliner’s eye toggle cleared', () => {
    const nodes = [foldable('FC', false, [label('Contents')])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SelectionProvider>
          <HiddenSeeder paths={['FC/Contents']} />
          {children}
        </SelectionProvider>
      ),
    });
    expect(result.current.tree[0]!.children[0]!.hidden).toBe(true);
  });

  describe('TabContainer shows the current page and HIDES every other', () => {
    // `_repaint` shows `i == current` and hides the rest
    // (`tab_container.cpp:377-399`), after `add_child_notify` hid each page (`:651`).
    // An editor-saved scene writes the hidden pages itself, so a hand-edited one shows it.
    function tabs(properties: Record<string, unknown>, pages: TscnNode[]): TscnNode {
      return node('TC', 'TabContainer', {
        properties: { name: 'TC', ...properties } as Record<string, unknown>,
        children: pages,
      });
    }
    const visibleOf = (tree: readonly SolveNode[]) =>
      tree[0]!.children.map((c) => (c.node.properties as { visible?: boolean }).visible);

    it('selects page 0 when the file authors no `current_tab` — `add_tab` sets it (tab_bar.cpp:1324-1331)', () => {
      const nodes = [tabs({}, [label('First'), label('Second')])];
      const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
      expect(visibleOf(result.current.tree)).toEqual([true, false]);
    });

    it('honours an authored `current_tab`', () => {
      const nodes = [tabs({ currentTab: 1 }, [label('First'), label('Second')])];
      const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
      expect(visibleOf(result.current.tree)).toEqual([false, true]);
    });

    it('leaves page 0 selected when `current_tab` is past the last page (tab_bar.cpp:800-804)', () => {
      const nodes = [tabs({ currentTab: 5 }, [label('First'), label('Second')])];
      const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
      expect(visibleOf(result.current.tree)).toEqual([true, false]);
    });

    it('refuses `current_tab = -1` while deselection is off (tab_bar.cpp:796-798, 1862-1873)', () => {
      const nodes = [tabs({ currentTab: -1 }, [label('First'), label('Second')])];
      const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
      expect(visibleOf(result.current.tree)).toEqual([true, false]);
    });

    it('accepts `current_tab = -1` with `deselect_enabled`, hiding every page', () => {
      const nodes = [tabs({ currentTab: -1, deselectEnabled: true }, [label('First'), label('Second')])];
      const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
      expect(visibleOf(result.current.tree)).toEqual([false, false]);
    });

    it('accepts it too when every tab is disabled or hidden, with deselection still off', () => {
      const nodes = [
        tabs({ currentTab: -1, tabOverrides: { 0: { disabled: true }, 1: { hidden: true } } }, [
          label('First'),
          label('Second'),
        ]),
      ];
      const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
      expect(visibleOf(result.current.tree)).toEqual([false, false]);
    });

    it('numbers the pages past a `top_level` child, which is no page at all (container.cpp:143-146)', () => {
      const nodes = [
        tabs({ currentTab: 1 }, [label('Floating', { topLevel: true }), label('First'), label('Second')]),
      ];
      const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
      const pages = result.current.tree[0]!.children;
      expect(pages.map((c) => c.node.name)).toEqual(['First', 'Second']);
      expect(pages.map((c) => (c.node.properties as { visible?: boolean }).visible)).toEqual([false, true]);
      const floating = result.current.tree.find((n) => n.path === 'TC/Floating')!;
      expect((floating.node.properties as { visible?: boolean }).visible).toBeUndefined();
    });
  });

  // The consequence the property write exists for: `isSortableControl` reads
  // `visible`, so the write decides whether the child gets a slot at all.
  function solveFoldable(folded: boolean): ReadonlyMap<string, SolvedControl> {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[node name="Root" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="FC" type="FoldableContainer" parent="."]
layout_mode = 1
offset_right = 200.0
offset_bottom = 120.0
folded = ${folded}
title = "T"

[node name="Contents" type="ColorRect" parent="FC"]
layout_mode = 2
visible = false
`);
    const loader = createFakeResourceLoader();
    const { result } = renderHook(
      () => useBuildSolveTree(scene.nodes, scene.externalResources, scene.internalResources),
      { wrapper: wrapperFor(loader.loader) }
    );
    return solveControlTree(result.current.tree, { x: 0, y: 0, w: 1152, h: 648 }, createSolveContext(nativeTheme(1)));
  }

  it('gives an unfolded container’s authored-invisible child the inner rect, `size.x` minus both panel margins (foldable_container.cpp:366-368)', () => {
    // `content_margin` is 4 on every side at scale 1 (`default_theme.cpp`).
    expect(solveFoldable(false).get('Root/FC/Contents')!.rect.w).toBe(200 - 4 - 4);
  });

  it('hands a folded container’s child no rect, so the solver’s zero fallback floored at its own minimum is what stands', () => {
    // A ColorRect's minimum is (0, 0); a child with a text or
    // `custom_minimum_size` minimum keeps a real rect here and is unobservable
    // only because the write above cleared its `visible`.
    expect(solveFoldable(true).get('Root/FC/Contents')!.rect).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('leaves every other container’s children at their authored `visible`', () => {
    const box = node('VB', 'VBoxContainer', {
      properties: { name: 'VB' } as Record<string, unknown>,
      children: [label('Contents', { visible: false })],
    });
    const { result } = renderHook(() => useBuildSolveTree([box], [], []));
    const child = result.current.tree[0]!.children[0]!;
    expect((child.node.properties as { visible?: boolean }).visible).toBe(false);
  });
});
