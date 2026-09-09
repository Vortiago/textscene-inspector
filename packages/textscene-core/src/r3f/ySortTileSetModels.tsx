/**
 * One resolved TileSet per distinct `tile_set` among a flat sort's y-sorted
 * TileMapLayer items.
 *
 * A tile row's sort key comes from its OWN grid's pitch, so two y-sorted layers
 * naming different TileSets cannot share one model: bucketing 64px rows against
 * a 32px grid interleaves them with their siblings at the wrong depths, while
 * `TileGroupRenderer` re-resolves per layer and draws each row from the right
 * one. The sorter and the renderer have to agree.
 *
 * Resolved by RECURSION because `useTileSetModel` is a hook and the ref count is
 * data-dependent: each level calls it once for its own ref and hands the rest to
 * the next, so every component instance keeps a fixed hook order.
 */

import { useMemo, type ReactNode } from 'react';
import type { TileSetModel } from '../resources/tileset/types.js';
import { useTileSetModel } from './useTileSetModel.js';
import type { YSortItem } from './ySortItems.js';

const NO_MODELS: ReadonlyMap<string, TileSetModel> = new Map();

/** Every distinct `tile_set` the tileGroup items name, in first-seen order. */
export function tileSetRefsOf(items: readonly YSortItem[]): string[] {
  const refs = new Set<string>();
  for (const item of items) {
    if (item.kind === 'tileGroup' && item.tileData?.tileSetRef) refs.add(item.tileData.tileSetRef);
  }
  return [...refs];
}

/**
 * Resolve `refs` and hand the loaded models to `children`, keyed by ref.
 *
 * Only loaded models are in the map, so a ref that is missing from it is one
 * whose TileSet has not arrived — the caller leaves that layer unexpanded, as it
 * does while any TileSet is still loading.
 */
export function TileSetModels({
  refs,
  resolved = NO_MODELS,
  children,
}: {
  refs: readonly string[];
  resolved?: ReadonlyMap<string, TileSetModel>;
  children: (models: ReadonlyMap<string, TileSetModel>) => ReactNode;
}): ReactNode {
  const head = refs[0];
  const { model, status } = useTileSetModel(head);
  const next = useMemo(() => {
    if (!head || status !== 'loaded' || !model) return resolved;
    const merged = new Map(resolved);
    merged.set(head, model);
    return merged;
  }, [head, model, status, resolved]);
  const rest = useMemo(() => refs.slice(1), [refs]);

  if (rest.length === 0) return <>{children(next)}</>;
  return (
    <TileSetModels refs={rest} resolved={next}>
      {children}
    </TileSetModels>
  );
}
