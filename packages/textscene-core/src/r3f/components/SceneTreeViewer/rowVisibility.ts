import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { Scene } from '../../../scene/openScene.js';
import { useLandedRead, type LandingRead } from '../TscnPreviewShell/sceneRead.js';
import { rowsOf, type TreeRow } from './treeRows.js';

const NO_VISIBILITY: ReadonlyMap<string, boolean> = new Map();
const NO_REVISION = () => () => undefined;

/** Each eye row's `visible` by live path, read again on a write. The last read shows until the next lands. */
export function useRowVisibility(
  scene: Scene | undefined,
  root: TreeRow | null
): ReadonlyMap<string, boolean> {
  const revision = useSyncExternalStore(scene?.subscribe ?? NO_REVISION, () => scene?.revision() ?? 0);
  // The same map while no value moves, so a write that leaves every eye draws no row again.
  const last = useRef(NO_VISIBILITY);
  const start = useMemo(
    () =>
      root &&
      ((): LandingRead<ReadonlyMap<string, boolean>> => ({
        root: root.node,
        answer: visibilityOf(root).then((read) => (last.current = sameVisibility(last.current, read))),
      })),
    // A write moves `revision` and no row, and each write reads the eyes again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [root, revision]
  );
  return useLandedRead(scene, start) ?? NO_VISIBILITY;
}

async function visibilityOf(root: TreeRow): Promise<ReadonlyMap<string, boolean>> {
  const rows = rowsOf(root).filter((row) => row.chain);
  const answers = await Promise.all(rows.map((row) => row.node.get('visible')));
  return new Map(rows.map((row, index) => [row.path, answers[index] !== false]));
}

function sameVisibility(
  last: ReadonlyMap<string, boolean>,
  read: ReadonlyMap<string, boolean>
): ReadonlyMap<string, boolean> {
  const isSame = last.size === read.size && [...read].every(([path, visible]) => last.get(path) === visible);
  return isSame ? last : read;
}
