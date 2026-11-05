/**
 * `useBuildSolveTree` lists the windows a forest's viewport would embed: each `Window` below it, in
 * the tree's pre-order, with its theme resolved like a Control's. The window's Controls stay out of
 * the forest, since they draw in the window's own viewport.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { useBuildSolveTree } from './buildSolveTree';
import { themeResource } from './testing/themeResource';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
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

  it('leaves out a native window, and still reaches the windows inside it', () => {
    const nodes = [node('Native', 'Window', { force_native: true }, [node('Embedded', 'Window')])];
    expect(windowPaths(nodes)).toEqual(['Native/Embedded']);
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
