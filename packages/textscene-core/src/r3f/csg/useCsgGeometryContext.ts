/**
 * The context a CSG root builds its plan's solids against: the scene's pools, each `.tres` and each
 * font a shape in its plan reads, and the outlines and metrics of those fonts once they settle. A node inside an
 * ancestor's plan passes null and takes the root's context from `CsgSubtreeContext`, so only the
 * root loads.
 */

import { useCallback, useMemo } from 'react';
import type { TscnNode } from '../../parser/types';
import { useSceneFontSettleCount } from '../controls/native/text/useSceneFontSettleCount';
import type { ProjectFonts } from '../../resources/fonts/font/projectFonts';
import type { LoadedFile, LoadedFont } from '../../resources/scopedResource';
import { useLoadedFilesAndFonts } from '../../resources/useLoadedFilesAndFonts';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { useSceneResources, type SceneResources } from '../SceneResourcesContext';
import type { CsgGeometryContext, CsgShapeRegistration } from './csgRegistration';

export interface CsgGeometrySetup {
  context: CsgGeometryContext;
  /** True while a file the plan reads has neither loaded nor failed, or a font awaits its outlines or metrics. */
  isLoading: boolean;
  /** True while a font file or a project font loads: a TextMesh builds nothing yet, as the bundled font is not its font. */
  isLoadingFonts: boolean;
}

export function useCsgGeometryContext(root: TscnNode | null): CsgGeometrySetup {
  const pools = useSceneResources();
  const shapes = useMemo(() => (root ? subtreeShapes(root) : []), [root]);
  const filesPlan = useCallback(
    (loadedFile: LoadedFile) => subtreeFiles(shapes, pools, loadedFile),
    [shapes, pools]
  );
  // A plan with no shape that can read a font names no font bus, so it listens to none.
  const readsFonts = shapes.some(({ shape }) => shape.readsFonts);
  const fontsPlan = useCallback(
    (loadedFont: LoadedFont, loadedFile: LoadedFile, projectFonts: ProjectFonts) =>
      subtreeFontFiles(shapes, { ...pools, loadedFile, loadedFont, projectFonts }),
    [shapes, pools]
  );
  const { loadedFile, loadedFont, projectFonts, isLoading, isLoadingFonts } = useLoadedFilesAndFonts(
    filesPlan,
    fontsPlan,
    readsFonts
  );

  const loaded = useMemo(
    (): CsgGeometryContext => ({ ...pools, loadedFile, loadedFont, projectFonts }),
    [pools, loadedFile, loadedFont, projectFonts]
  );
  const isAwaitingFont = shapes.some(({ properties, shape }) => shape.awaitsFont?.(properties, loaded));
  useSceneFontSettleCount(isAwaitingFont);
  // The meshes of a context hold the metrics they read, so a context that read them before they
  // settled gives way to a copy, with meshes of its own, when they have.
  const context = useMemo(
    () => ({ ...loaded }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `isAwaitingFont` only re-keys the copy.
    [loaded, isAwaitingFont]
  );
  const isLoadingBuild = isLoading || isAwaitingFont;
  return useMemo(
    () => ({ context, isLoading: isLoadingBuild, isLoadingFonts }),
    [context, isLoadingBuild, isLoadingFonts]
  );
}

/** A CSG node of the plan, with the registration of its shape. */
interface PlannedShape {
  properties: Record<string, unknown>;
  shape: CsgShapeRegistration;
}

/** The shapes of `root` and of its CSG descendants, in tree order. Only CSG children join the root's boolean (`csgPlan.ts`). */
function subtreeShapes(root: TscnNode): PlannedShape[] {
  const planned: PlannedShape[] = [];
  const visit = (node: TscnNode): void => {
    const shape = nodeComponentRegistry.getCsgShape(node.type);
    if (!shape) return;
    planned.push({ properties: node.properties as Record<string, unknown>, shape });
    node.children.forEach(visit);
  };
  visit(root);
  return planned;
}

/** `paths` once each, sorted. */
const sortedUnique = (paths: readonly string[]): string[] => [...new Set(paths)].sort();

/** Each `.tres` a shape of the plan reads, sorted. */
function subtreeFiles(
  shapes: readonly PlannedShape[],
  pools: SceneResources,
  loadedFile: LoadedFile
): string[] {
  return sortedUnique(
    shapes.flatMap(({ properties, shape }) => shape.readsFiles?.(properties, pools, loadedFile) ?? [])
  );
}

/** Each font file a shape of the plan reads, sorted. */
function subtreeFontFiles(shapes: readonly PlannedShape[], ctx: CsgGeometryContext): string[] {
  return sortedUnique(shapes.flatMap(({ properties, shape }) => shape.readsFonts?.(properties, ctx) ?? []));
}
