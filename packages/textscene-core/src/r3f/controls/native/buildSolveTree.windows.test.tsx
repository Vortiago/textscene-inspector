/**
 * `useBuildSolveTree` lists the windows a forest's viewport would embed: each `Window` below it, in
 * the tree's pre-order, with its theme resolved like a Control's. The window's Controls stay out of
 * the forest, since they draw in the window's own viewport.
 */
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { useBuildSolveTree, useBuildViewportTree } from './buildSolveTree';
import { themeResource } from './testing/themeResource';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { PROJECT_ROOT_EMBEDS_NO_WINDOWS, withProject } from '../../testing/ProjectFixture';
import '../../nodes/index';
import '../index';

function node(
  name: string,
  type: string,
  properties: Record<string, unknown> = {},
  children: TscnNode[] = []
) {
  return { rawProperties: {}, name, type, children, properties: { name, ...properties } } as TscnNode;
}

const NO_OWNERS = [] as const;

/** A window that authors `gui_embed_subwindows`, above another window. */
const HOST = node('Host', 'Window', { gui_embed_subwindows: true }, [node('Inner', 'Window')]);

function windowPaths(nodes: TscnNode[]): string[] {
  const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));
  return result.current.windows.map((window) => window.path);
}

describe('useBuildSolveTree — embedded windows', () => {
  it('lists a Window and keeps its Controls out of the forest', () => {
    const nodes = [node('Root', 'Control', {}, [node('Dialog', 'Window', {}, [node('Inside', 'Label')])])];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));

    expect(result.current.windows.map((window) => window.path)).toEqual(['Root/Dialog']);
    expect(result.current.tree.map((root) => root.path)).toEqual(['Root']);
    expect(result.current.tree[0]!.children).toEqual([]);
  });

  it('lists the windows in pre-order, a parent window before the window inside it', () => {
    const nodes = [node('Outer', 'Window', {}, [node('Inner', 'Popup')]), node('Last', 'PopupPanel')];
    expect(windowPaths(nodes)).toEqual(['Outer', 'Outer/Inner', 'Last']);
  });

  it('reaches a window through a SubViewport that embeds none (`window.cpp:get_embedder`)', () => {
    const nodes = [node('View', 'SubViewport', { gui_embed_subwindows: false }, [node('Dialog', 'Window')])];
    expect(windowPaths(nodes)).toEqual(['View/Dialog']);
  });

  it('leaves a window to the SubViewport that embeds it', () => {
    const nodes = [node('View', 'SubViewport', { gui_embed_subwindows: true }, [node('Dialog', 'Window')])];
    expect(windowPaths(nodes)).toEqual([]);
  });

  it('leaves out a native window and the windows it embeds (`window.cpp:1534-1537`)', () => {
    const nodes = [node('Native', 'Window', { force_native: true }, [node('Embedded', 'Window')])];
    expect(windowPaths(nodes)).toEqual([]);
  });

  it('reaches the windows inside a window whose authored gui_embed_subwindows is reset on entering the tree', () => {
    expect(windowPaths([HOST])).toEqual(['Host', 'Host/Inner']);
  });

  describe('under a root window that embeds none', () => {
    const wrapper = withProject(PROJECT_ROOT_EMBEDS_NO_WINDOWS);

    it('lists no window for the root, since each is native', async () => {
      const { result } = renderHook(() => useBuildSolveTree([HOST], [], []), { wrapper });
      await waitFor(() => expect(result.current.windows).toEqual([]));
    });

    it('lists the windows of a window that authors gui_embed_subwindows, which stands there', async () => {
      const { result } = renderHook(() => useBuildViewportTree(HOST, [], [], NO_OWNERS), { wrapper });
      await waitFor(() =>
        expect(result.current.windows.map((window) => window.path)).toEqual(['Host/Inner'])
      );
    });
  });

  it('gives a window the theme of the Control above it, as a ThemeOwner does (`theme_owner.cpp`)', () => {
    const loader = createFakeResourceLoader();
    loader.themes.seed(
      'res://theme.tres',
      themeResource({ colors: { Window: { title_color: { r: 1, g: 0, b: 0, a: 1 } } } })
    );
    const nodes = [node('Root', 'Control', { theme: 'ExtResource("1_theme")' }, [node('Dialog', 'Window')])];
    const externalResources = [{ id: '1_theme', path: 'res://theme.tres', type: 'Theme' }];
    const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={loader.loader}>{children}</ResourceLoaderProvider>
      ),
    });

    expect(result.current.windows[0]!.colors.title_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('resolves the window’s own theme overrides', () => {
    const nodes = [node('Dialog', 'Window', { themeOverrideConstants: { title_height: 50 } })];
    const { result } = renderHook(() => useBuildSolveTree(nodes, [], []));

    expect(result.current.windows[0]!.constants.title_height).toBe(50);
  });
});

describe('useBuildViewportTree — the Controls a viewport draws', () => {
  const serving = (themes: Record<string, ReturnType<typeof themeResource>>) => {
    const loader = createFakeResourceLoader();
    for (const [path, theme] of Object.entries(themes)) loader.themes.seed(path, theme);
    return ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={loader.loader}>{children}</ResourceLoaderProvider>
    );
  };

  it('roots the forest at the window, with its Controls below it', () => {
    const window = node('Dialog', 'Window', {}, [node('Inside', 'Label')]);
    const { result } = renderHook(() => useBuildViewportTree(window, [], [], NO_OWNERS));

    expect(result.current.tree.map((root) => root.path)).toEqual(['Dialog']);
    expect(result.current.tree[0]!.children.map((child) => child.path)).toEqual(['Dialog/Inside']);
  });

  it('lists the windows of a SubViewport that embeds them, and none where it embeds none', () => {
    const viewport = (embeds: boolean) =>
      node('View', 'SubViewport', { gui_embed_subwindows: embeds }, [node('Dialog', 'Window')]);
    const windowsOf = (embeds: boolean) =>
      renderHook(() => useBuildViewportTree(viewport(embeds), [], [], NO_OWNERS)).result.current.windows;

    expect(windowsOf(true).map((window) => window.path)).toEqual(['Dialog']);
    expect(windowsOf(false)).toEqual([]);
  });

  it('lists no window for a window under an embedding root, whatever it authors (`window.cpp:1534-1537`)', () => {
    const { result } = renderHook(() => useBuildViewportTree(HOST, [], [], NO_OWNERS));

    expect(result.current.windows).toEqual([]);
  });

  it('roots a SubViewport’s forest at its children, as the viewport is no Control', () => {
    const viewport = node('View', 'SubViewport', {}, [node('Inside', 'Label')]);
    const { result } = renderHook(() => useBuildViewportTree(viewport, [], [], NO_OWNERS));

    expect(result.current.tree.map((root) => root.path)).toEqual(['Inside']);
  });

  it('draws the Controls of a hidden window, whose visibility is its embedder’s to apply', () => {
    const popup = node('Menu', 'Popup', { visible: false }, [node('Inside', 'Label')]);
    const { result } = renderHook(() => useBuildViewportTree(popup, [], [], NO_OWNERS));

    expect((result.current.tree[0]!.node.properties as { visible: boolean }).visible).toBe(true);
  });

  it('hands the window’s theme to its Controls, then the theme of each owner above it', () => {
    const own = themeResource({ defaultFontSize: 20 });
    const above = themeResource({ defaultFontSize: 30 });
    const window = node('Dialog', 'Window', { theme: 'ExtResource("own")' }, [node('Inside', 'Label')]);
    const owner = node('Root', 'Control', { theme: 'ExtResource("above")' });
    const externalResources = [
      { id: 'own', path: 'res://own.tres', type: 'Theme' },
      { id: 'above', path: 'res://above.tres', type: 'Theme' },
    ];
    const owners = [{ node: owner, scope: { externalResources, internalResources: [] } }];
    const { result } = renderHook(() => useBuildViewportTree(window, externalResources, [], owners), {
      wrapper: serving({ 'res://own.tres': own, 'res://above.tres': above }),
    });

    expect(result.current.tree[0]!.children[0]!.themeChain).toEqual([own, above]);
  });
});
