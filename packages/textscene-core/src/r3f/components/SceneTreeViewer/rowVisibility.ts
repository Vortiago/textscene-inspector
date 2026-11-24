import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Scene } from '../../../scene/openScene.js';
import * as logger from '../../../logger.js';
import type { TreeRow } from './treeRows.js';

const NO_VISIBILITY: ReadonlyMap<string, boolean> = new Map();
const NO_REVISION = () => () => undefined;

/** Each eye row's `visible` by live path, read again on a write. The last read shows until the next lands. */
export function useRowVisibility(
  scene: Scene | undefined,
  root: TreeRow | null
): ReadonlyMap<string, boolean> {
  const revision = useSyncExternalStore(scene?.subscribe ?? NO_REVISION, () => scene?.revision() ?? 0);
  const [landed, setLanded] = useState<{ scene: Scene; visibility: ReadonlyMap<string, boolean> } | null>(
    null
  );
  useEffect(() => {
    if (!root || !scene) return undefined;
    let isLatest = true;
    visibilityOf(root)
      .then((visibility) => {
        if (isLatest) setLanded({ scene, visibility });
      })
      .catch((error: unknown) => {
        // A new text frees the nodes during the read, and the rows read again over the new ones.
        if (root.node.isInsideTree())
          logger.error(`expected each row's visible to read, got ${String(error)}`);
      });
    return () => {
      isLatest = false;
    };
  }, [scene, root, revision]);
  return landed && landed.scene === scene ? landed.visibility : NO_VISIBILITY;
}

async function visibilityOf(root: TreeRow): Promise<ReadonlyMap<string, boolean>> {
  const rows = rowsWithEye(root);
  const answers = await Promise.all(rows.map((row) => row.node.get('visible')));
  return new Map(rows.map((row, index) => [row.path, answers[index] !== false]));
}

function rowsWithEye(row: TreeRow): TreeRow[] {
  const below = row.children.flatMap(rowsWithEye);
  return row.chain ? [row, ...below] : below;
}
