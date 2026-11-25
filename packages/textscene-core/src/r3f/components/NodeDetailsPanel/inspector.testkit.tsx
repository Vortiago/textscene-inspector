import { act, render, screen, type RenderResult } from '@testing-library/react';
import { expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Scene } from '../../../scene/openScene';
import { absolutePathOf } from '../../../scene/nodePathWalk';
import type { UndrawnNode } from '../../viewStatus/undrawnNodes';
import { EMPTY_VIEW_STATUS } from '../../viewStatus/viewStatus';
import { createExternalStore } from '../../../utils/externalStore';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { PreviewViewStatusProvider } from '../TscnPreviewShell/previewViewStatus';
import { TestPreviewCamera } from '../TscnPreviewShell/previewCamera.testkit';
import { openTreeScene, type TreeFiles } from '../SceneTreeViewer/sceneTree.testkit';
import { NodeDetailsPanel } from './NodeDetailsPanel';

export interface InspectorOptions {
  readonly files?: TreeFiles;
  readonly rootScenePath?: string;
  /** What the shell's view reports it does not draw. */
  readonly undrawn?: readonly UndrawnNode[];
  readonly onCopyNodePath?: (nodePath: string) => void;
  /** Mounts the shell's camera preview, which the Camera3D Preview checkbox drives. */
  readonly hasPreviewCamera?: boolean;
}

function Selector({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  return <button data-testid="select-node" onClick={() => setSelectedNodePath(path)} />;
}

/** Selects the node at the live path `selected` once the scene holds it, and waits for its heading. */
export async function renderInspector(
  source: string,
  selected: string | null,
  options: InspectorOptions = {}
): Promise<RenderResult & { readonly scene: Scene }> {
  const { files, rootScenePath, undrawn = [], onCopyNodePath, hasPreviewCamera = false } = options;
  const scene = openTreeScene(source, files, rootScenePath);
  const status = createExternalStore({ status: { ...EMPTY_VIEW_STATUS, undrawn }, round: 0 });
  const panel: ReactNode = (
    <>
      <NodeDetailsPanel onCopyNodePath={onCopyNodePath} />
      <Selector path={selected} />
    </>
  );
  const rendered = render(
    <HierarchyProvider value={{ sceneGraph: scene.written(), panelId: 'p', scene }}>
      <PreviewViewStatusProvider value={status}>
        <SelectionProvider>
          {hasPreviewCamera ? <TestPreviewCamera>{panel}</TestPreviewCamera> : panel}
        </SelectionProvider>
      </PreviewViewStatusProvider>
    </HierarchyProvider>
  );
  if (selected !== null) {
    await vi.waitFor(() => expect(scene.getNodeOrNull(absolutePathOf(selected))).not.toBeNull());
    await act(async () => screen.getByTestId('select-node').click());
    await screen.findByRole('heading', { name: scene.getNode(absolutePathOf(selected)).name });
  }
  return { scene, ...rendered };
}
