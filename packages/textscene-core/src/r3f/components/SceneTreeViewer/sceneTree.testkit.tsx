import { fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import { expect } from 'vitest';
import type { ReactNode } from 'react';
import '../../sceneLiveTree.js';
import { openScene, type Scene } from '../../../scene/openScene';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type { UndrawnNode } from '../../viewStatus/undrawnNodes';
import { createExternalStore } from '../../../utils/externalStore';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { ExpandedRowsProvider } from '../TscnPreviewShell/expandedRows';
import { PreviewViewStatusProvider } from '../TscnPreviewShell/previewViewStatus';
import { SceneTreeViewer, type SceneTreeViewerProps } from './SceneTreeViewer';
import { treeRowsOf, type TreeRow } from './treeRows';

/** The files a scene of a tree test instances, by `res://` path: a text, or the bytes of a binary file. */
export type TreeFiles = Readonly<Record<string, string | ArrayBuffer>>;

export interface TreeOptions extends SceneTreeViewerProps {
  readonly files?: TreeFiles;
  /** What the shell's view reports it does not draw. */
  readonly undrawn?: readonly UndrawnNode[];
  /** Rendered beside the tree, inside its providers. */
  readonly beside?: ReactNode;
  readonly rootScenePath?: string;
}

/** The scene a tree test opens: its files load through the provider, as a host's do. */
export function openTreeScene(source: string, files: TreeFiles = {}, rootScenePath?: string): Scene {
  const provider: ResourceProvider = { loadResource: async (path) => files[path] ?? null };
  return openScene({ source, provider, rootScenePath });
}

/** Renders the Scene tree of `source` and waits for its root row. */
export async function renderSceneTree(
  source: string,
  options: TreeOptions = {}
): Promise<RenderResult & { readonly scene: Scene }> {
  const { files, undrawn = [], beside, rootScenePath, ...props } = options;
  const scene = openTreeScene(source, files, rootScenePath);
  const status = createExternalStore({
    status: {
      settled: null,
      pending: { textures: 0, fonts: 0 },
      frame: null,
      undrawn,
      isSoftwareRendering: false,
      freelook: null,
    },
    round: 0,
  });
  const rendered = render(
    <HierarchyProvider value={{ sceneGraph: scene.written(), panelId: 'p', scene }}>
      <PreviewViewStatusProvider value={status}>
        <SelectionProvider>
          <ExpandedRowsProvider>
            <SceneTreeViewer {...props} />
            {beside}
          </ExpandedRowsProvider>
        </SelectionProvider>
      </PreviewViewStatusProvider>
    </HierarchyProvider>
  );
  await screen.findByRole('treeitem');
  return { scene, ...rendered };
}

/** The row element of the node at the live path `path`, or null. */
export function rowAt(path: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-node-path="${path}"]`);
}

function rowCountOf(row: TreeRow): number {
  return 1 + row.children.reduce((count, child) => count + rowCountOf(child), 0);
}

/** Expands every row once the tree shows each row the loaded scene lists, which no file load signals. */
export async function expandAllRows(scene: Scene): Promise<void> {
  const root = scene.getNodeOrNull(ROOT_WINDOW_PATH)?.getChildren()[0];
  if (!root) throw new Error('expected a scene root to expand, got none');
  const listedCount = rowCountOf(await treeRowsOf(root));
  await waitFor(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(document.querySelectorAll('[data-node-path]')).toHaveLength(listedCount);
  });
}
