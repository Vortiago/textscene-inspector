/**
 * `useBuildSolveTree` settles a FileDialog with the folder its provider lists: the walk requests the folder, and the dialog's
 * rows arrive once the listing is cached.
 */
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { FileEventBus } from '../../../resources/FileEventBus';
import { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { parseFileDialog, type FileDialogProperties } from '../../../nodes/windows/filedialog/parser';
import { useBuildSolveTree, useBuildViewportTree } from './buildSolveTree';
import '../../nodes/index';
import '../index';

const dialog = (lines: Record<string, string>): TscnNode =>
  ({
    name: 'Dialog',
    type: 'FileDialog',
    children: [],
    rawProperties: lines,
    properties: parseFileDialog(heading('FileDialog', { name: 'Dialog' }), lines),
  }) as unknown as TscnNode;

function wrapperOver(provider: ResourceProvider) {
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  return ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
  );
}

const rowsOf = (props: FileDialogProperties) => props.file_rows.map(({ name }) => name);

describe('useBuildSolveTree — a FileDialog with a folder listing', () => {
  const lists = (folders: Record<string, { name: string; isDirectory: boolean }[]>): ResourceProvider => ({
    loadResource: async () => null,
    listDirectory: async (folder) => folders[folder] ?? null,
  });

  it('gives the dialog the rows of res:// once the provider has listed it', async () => {
    const wrapper = wrapperOver(
      lists({
        'res://': [
          { name: 'sub', isDirectory: true },
          { name: 'a.png', isDirectory: false },
        ],
      })
    );
    const { result } = renderHook(() => useBuildSolveTree([dialog({})], [], []), { wrapper });
    await waitFor(() =>
      expect(rowsOf(result.current.windows[0]!.node.properties as FileDialogProperties)).toEqual([
        'sub',
        'a.png',
      ])
    );
  });

  it('lists the folder current_dir names', async () => {
    const wrapper = wrapperOver(
      lists({
        'res://': [{ name: 'sub', isDirectory: true }],
        'res://sub': [{ name: 'in.png', isDirectory: false }],
      })
    );
    const { result } = renderHook(() => useBuildSolveTree([dialog({ current_dir: '"res://sub"' })], [], []), {
      wrapper,
    });
    await waitFor(() =>
      expect(rowsOf(result.current.windows[0]!.node.properties as FileDialogProperties)).toEqual(['in.png'])
    );
  });

  it('reaches a dialog below a Control', async () => {
    const root = {
      name: 'Root',
      type: 'Control',
      rawProperties: {},
      properties: { name: 'Root' },
      children: [dialog({})],
    };
    const wrapper = wrapperOver(lists({ 'res://': [{ name: 'a.png', isDirectory: false }] }));
    const { result } = renderHook(() => useBuildSolveTree([root as unknown as TscnNode], [], []), {
      wrapper,
    });
    await waitFor(() =>
      expect(rowsOf(result.current.windows[0]!.node.properties as FileDialogProperties)).toEqual(['a.png'])
    );
  });

  it('settles the dialog that roots the viewport it is drawn in', async () => {
    const wrapper = wrapperOver(lists({ 'res://': [{ name: 'a.png', isDirectory: false }] }));
    const { result } = renderHook(() => useBuildViewportTree(dialog({}), [], [], []), { wrapper });
    await waitFor(() =>
      expect(rowsOf(result.current.tree[0]!.node.properties as FileDialogProperties)).toEqual(['a.png'])
    );
  });

  it('keeps the list empty under a provider that cannot list', async () => {
    const wrapper = wrapperOver({ loadResource: async () => null });
    const { result } = renderHook(() => useBuildSolveTree([dialog({})], [], []), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(rowsOf(result.current.windows[0]!.node.properties as FileDialogProperties)).toEqual([]);
  });
});
