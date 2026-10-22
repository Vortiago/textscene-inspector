/**
 * The context a CSG root builds its plan's solids against: the scene's pools, and each `.tres` a
 * shape in its plan reads. A node inside an ancestor's plan passes null and takes the root's context
 * from `CsgSubtreeContext`, so only the root loads.
 */

import { useCallback, useMemo } from 'react';
import type { TscnNode } from '../../parser/types';
import type { LoadedFile } from '../../resources/scopedResource';
import { useLoadedFiles } from '../../resources/useLoadedFiles';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { useSceneResources, type SceneResources } from '../SceneResourcesContext';
import type { CsgGeometryContext } from './csgRegistration';

export interface CsgGeometrySetup {
  context: CsgGeometryContext;
  /** True while a file the plan reads has neither loaded nor failed. */
  isLoading: boolean;
}

export function useCsgGeometryContext(root: TscnNode | null): CsgGeometrySetup {
  const pools = useSceneResources();
  const plan = useCallback(
    (loadedFile: LoadedFile) => (root ? subtreeFiles(root, pools, loadedFile) : []),
    [root, pools]
  );
  const { loadedFile, isLoading } = useLoadedFiles(plan);
  const context = useMemo((): CsgGeometryContext => ({ ...pools, loadedFile }), [pools, loadedFile]);
  return useMemo(() => ({ context, isLoading }), [context, isLoading]);
}

/** Each `.tres` a CSG shape under `root` reads, sorted. Only CSG children join the root's boolean (`csgPlan.ts`). */
function subtreeFiles(root: TscnNode, pools: SceneResources, loadedFile: LoadedFile): string[] {
  const paths = new Set<string>();
  const visit = (node: TscnNode): void => {
    const shape = nodeComponentRegistry.getCsgShape(node.type);
    if (!shape) return;
    const files = shape.readsFiles?.(node.properties as Record<string, unknown>, pools, loadedFile) ?? [];
    files.forEach((path) => paths.add(path));
    node.children.forEach(visit);
  };
  visit(root);
  return [...paths].sort();
}
