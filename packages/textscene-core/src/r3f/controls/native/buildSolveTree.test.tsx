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
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource, TscnNode, TscnScene } from '../../../parser/types';
import { FileEventBus } from '../../../resources/FileEventBus';
import { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext';
import type { ThemeResource } from '../../../resources/processing/themeProcessing';
import type { FontResource } from '../../../resources/processing/fontProcessing';
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
