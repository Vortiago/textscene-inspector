import { useEffect, useState } from 'react';
import type { Scene } from '../../../scene/openScene.js';
import * as logger from '../../../logger.js';
import { rowsOf, type TreeRow } from './treeRows.js';

const NO_VISIBILITY: ReadonlyMap<string, boolean> = new Map();

/** Each eye row's `visible` by live path. A write reads again only the rows it can change. */
export function useRowVisibility(
  scene: Scene | undefined,
  root: TreeRow | null
): ReadonlyMap<string, boolean> {
  const [landed, setLanded] = useState<{ root: TreeRow; visibility: ReadonlyMap<string, boolean> } | null>(
    null
  );
  useEffect(() => {
    if (!scene || !root) return undefined;
    let isLatest = true;
    const rows = rowsOf(root).filter((row) => row.chain);
    const land = (read: ReadonlyMap<string, boolean>) => {
      if (!isLatest) return;
      setLanded((last) => {
        const visibility = last?.root === root ? last.visibility : NO_VISIBILITY;
        const next = withVisibility(visibility, read);
        return last?.root === root && next === visibility ? last : { root, visibility: next };
      });
    };
    const read = (reread: readonly TreeRow[]) =>
      visibilityOf(reread).then(land, (error: unknown) => {
        // A new text frees the nodes during the read, and the new tree reads its own.
        if (root.node.isInsideTree())
          logger.error(`expected the eye rows to read visible, got ${String(error)}`);
      });
    void read(rows);
    const removals = [...rowsByWrittenPath(rows)].map(([path, reread]) =>
      scene.observe(path, () => void read(reread))
    );
    return () => {
      isLatest = false;
      for (const remove of removals) remove();
    };
  }, [scene, root]);
  return landed && landed.root === root ? landed.visibility : NO_VISIBILITY;
}

async function visibilityOf(rows: readonly TreeRow[]): Promise<ReadonlyMap<string, boolean>> {
  const answers = await Promise.all(rows.map((row) => row.node.get('visible')));
  return new Map(rows.map((row, index) => [row.path, answers[index] !== false]));
}

/** The same map while every value stays, so a write that leaves the eyes draws no row again. */
function withVisibility(
  visibility: ReadonlyMap<string, boolean>,
  read: ReadonlyMap<string, boolean>
): ReadonlyMap<string, boolean> {
  if ([...read].every(([path, isVisible]) => visibility.get(path) === isVisible)) return visibility;
  return new Map([...visibility, ...read]);
}

/** A container's write can change its children's `visible`, as a TabContainer's current tab does. */
function rowsByWrittenPath(rows: readonly TreeRow[]): Map<string, TreeRow[]> {
  const byPath = new Map<string, TreeRow[]>();
  const add = (path: string, row: TreeRow) => byPath.set(path, [...(byPath.get(path) ?? []), row]);
  for (const row of rows) {
    add(row.node.path, row);
    const parent = row.node.getParent();
    if (parent) add(parent.path, row);
  }
  return byPath;
}
