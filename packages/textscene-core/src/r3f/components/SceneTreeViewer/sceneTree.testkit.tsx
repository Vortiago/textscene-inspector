import { fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import { expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import '../../sceneLiveTree.js';
import { openScene, type Scene } from '../../../scene/openScene';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type { UndrawnNode } from '../../viewStatus/undrawnNodes';
import { EMPTY_VIEW_STATUS } from '../../viewStatus/viewStatus';
import { createExternalStore } from '../../../utils/externalStore';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { ExpandedRowsProvider } from '../TscnPreviewShell/expandedRows';
import { PreviewViewStatusProvider } from '../TscnPreviewShell/previewViewStatus';
import { SceneTreeViewer, type SceneTreeViewerProps } from './SceneTreeViewer';
import { rowsOf, treeRowsOf } from './treeRows';

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
  const status = createExternalStore({ status: { ...EMPTY_VIEW_STATUS, undrawn }, round: 0 });
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

/** The live path of each row in the document, in the dock's pre-order. */
export function rowPaths(): string[] {
  return Array.from(document.querySelectorAll('[data-node-path]')).map((row) =>
    row.getAttribute('data-node-path')!
  );
}

/** Expands every row once the scene holds `lastLoaded` and the tree shows each row it lists. */
export async function expandAllRows(scene: Scene, lastLoaded?: string): Promise<void> {
  if (lastLoaded) await vi.waitFor(() => expect(scene.getNodeOrNull(lastLoaded)).not.toBeNull());
  const root = scene.getNodeOrNull(ROOT_WINDOW_PATH)?.getChildren()[0];
  if (!root) throw new Error('expected a scene root to expand, got none');
  const listedCount = rowsOf(await treeRowsOf(root)).length;
  await waitFor(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(document.querySelectorAll('[data-node-path]')).toHaveLength(listedCount);
  });
}
