/**
 * `useBuildSolveTree` walks the **Live scene tree** (`liveSceneTree.ts`,
 * ADR-0013) into the `SolveNode` forest the native rect solver consumes.
 * These scenarios exercise instancing on the SolveNode seam: a `.tscn`
 * composed the normal Godot way (a HUD instanced into a level, a widget
 * instanced into that HUD) must not lose content or resolve a StyleBox/
 * texture against the wrong scene's resource pool.
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
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource, TscnNode, TscnScene } from '../../../parser/types';
import { parseTresFile, type ParsedResource } from '../../../parser/parsedResource';
import { FileEventBus } from '../../../resources/FileEventBus';
import { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import type { FontResource } from '../../../resources/fonts/font/types';
import { resolveSceneFontMetrics } from './text/sceneFontLoader';
import { useBuildSolveTree } from './buildSolveTree';
import { TscnParser } from '../../../parser/TscnParser';
import { createSolveContext, solveControlTree, type SolvedControl } from './controlRectSolver';
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

/** Seeds `SelectionContext.hiddenNodePaths` from inside the provider. */
function HiddenPathSeeder({ paths }: { paths: readonly string[] }) {
  const { toggleHidden } = useSelection();
  useEffect(() => {
    for (const p of paths) toggleHidden(p);
  }, [paths, toggleHidden]);
  return null;
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

  it("resolves a HOST-authored child's StyleBox in the HOST's pool, even when it hangs off an instance node", () => {
    // The mirror of the test above, and the one that gates the host half of
    // the scope. A multi-root instance keeps the instance node in place and
    // splits its children into an `inline` group (host-authored, HOST scope)
    // and a `subscene` group (SUB scope). The sub-scene pool arrives on the
    // group by construction, but the HOST pool only reaches the inline group
    // because the walk passes it down — and that argument is optional, so
    // dropping it fails silently: the StyleBox simply stops resolving, with
    // no error and nothing else in this file going red.
    //
    // Both pools declare id "1" for different colours, so resolving against
    // the wrong one is loud (wrong numbers) rather than quiet (absent).
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
    // `resolveTextureSize` reads `node.properties.texture` generically for any
    // 2D-UI node — TextureRect just happens to be the first type whose native
    // minimum-size solver actually consumes this field
    // (`nodes/2d/ui/texturerect/nativeSolver.ts`).
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
    // Button's minimum-size solver (`nodes/2d/ui/button/nativeSolver.ts`)
    // needs the icon's own natural size the same way TextureRect needs its
    // texture's — `resolveTextureSize` reads whichever of `texture`/`icon` a
    // node actually carries, since the two node types never carry both.
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
    // resolution leaves this null and the node's minimum size collapses to
    // (0, 0) — inside a container that moves every sibling below it, not just
    // this node's own pixels. Measured against Godot 4.6.3: a
    // 160x160 GradientTexture2D in a VBoxContainer pushes the ColorRect below
    // it down by 160 px.
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
    // :33-53) report `rounded_region.size + margin.size`, so the cell — not the
    // 1024x1024 sheet — is what a Control reserves. Resolving the slot to the
    // sheet's PATH would answer 1024x1024 here, which is worse than the (0, 0)
    // an unresolved slot gives: it would push every sibling below it a
    // thousand pixels down.
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

function control(name: string, extra: Record<string, unknown> = {}): TscnNode {
  return node(name, 'Control', { properties: { name, ...extra } as Record<string, unknown> });
}

describe('useBuildSolveTree — theme resolution', () => {
  it("resolves a root Control's theme = ExtResource(...) and threads it to a themeless child's themeChain[0] — the corpus's dominant shape", () => {
    // The brief's central claim: a node-local read returns nothing for this
    // shape (a themed root, plain Labels beneath it) — only the ancestor
    // chain does.
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

    // 'Bridge' (Node3D) contributes no SolveNode — its Control descendant
    // promotes straight to 'Root's children — but the theme chain resets to
    // empty at that point rather than being inherited through it.
    const root = result.current.tree.find((n) => n.path === 'Root')!;
    const leaf = root.children.find((c) => c.path === 'Root/Bridge/Leaf')!;
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
    // Cold cache: the walk never blocks on the load, so the root Control
    // still gets a SolveNode — just with an empty theme chain for now.
    expect(result.current.tree[0]?.themeChain).toEqual([]);
    // The request only happens in the post-render effect, never inline
    // during the synchronous walk — asserted the same way the existing
    // texture/scene generation tests do: nothing resolves until `_resolve`
    // is called, proving the walk itself never requested it eagerly enough
    // to already be cached.
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
      // `peekSceneFontMetrics`'s own async pipeline — kicked off entirely
      // outside `loader`, inside the SOLVE pass itself, not through any
      // `loader.eventBus` channel this test's other generation-bump cases use.
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
    // End-to-end through the REAL ResourceLoader (not the fake): project.godot
    // is read via FileEventBus.tryLoad (ProjectSettingsContext), and the
    // referenced Theme .tres through the real Theme processor.
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

    // Unscaled — the literal `8` the project theme's own `.tres` declares,
    // never multiplied by this previewer's own built-in-default scale.
    expect(result.current.tree[0]?.constants.h_separation).toBe(8);
  });
});

/**
 * The inline-procedural texture's minimum-size contribution, end to end:
 * `.tscn` text → `useBuildSolveTree` → `solveControlTree`. The unit test above
 * proves `SolveNode.textureSize` is populated; this proves the number reaches
 * a SOLVED RECT, which is the part a purely visual check would attribute to
 * the painter.
 *
 * Expected positions are Godot 4.6.3's, read off a render of
 * `scenes/fixtures/unit-texturerect-gradienttexture.tscn` and
 * `unit-button-icon-gradienttexture.tscn` at the project viewport (1152x648).
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
 * The scene-tree eye toggle (`SelectionContext.hiddenNodePaths`) is the
 * previewer's stand-in for clearing a node's `visible` in the editor, so it has
 * to reach the SOLVE the same way `visible` does: `Container::_sort_children`
 * skips a child that `as_sortable_control` rejects
 * (`scene/gui/container.cpp::Container::_sort_children`), leaving no slot
 * behind. Setting only the emitted group's `visible` would keep the slot and
 * paint a permanent hole in the container.
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
              <HiddenPathSeeder paths={hidden} />
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
              <HiddenPathSeeder paths={['Root/Column/Second']} />
              {children}
            </SelectionProvider>
          </ResourceLoaderProvider>
        ),
      }
    );
    const column = result.current.tree[0]!.children[0]!;
    expect(column.children.map((c) => c.hidden)).toEqual([false, true, false]);
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

// A scene reached ONLY by the Control walk has no other component registering
// it: `createSceneProcessor` resolves an address through the MetadataStore, and
// for an unregistered one it throws "Scene metadata not found". That failure is
// cached like any other, so the instance never resolves on any later render —
// the registration has to precede the request, not merely accompany it.
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
      // A real Kenney-shaped file, run through the actual `.tres` parser —
      // mirrors `useTexture2D.test.tsx`'s own `.tres AtlasTexture` fixture.
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

      // The RESOURCE bus, never the texture one — the `.tres` is text (a
      // region declaration), not pixels.
      expect(result.current.generation).toBeGreaterThan(initialGeneration);
      expect(result.current.tree[0]?.textureSize).toEqual({ x: 64, y: 64 });
    }
  );
});
