/**
 * One resolved TileSet per distinct `tile_set` among a flat sort's y-sorted
 * TileMapLayer items. A tile row's sort key comes from its own grid's pitch, and
 * `TileGroupRenderer` draws each row from its own model, so the sorter must agree.
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
 * Resolve `refs` and hand the loaded models to `children`, keyed by ref. A ref
 * missing from the map has not arrived, and the caller leaves that layer unexpanded.
 * Recursive, one `useTileSetModel` per level, so each instance keeps a fixed hook order.
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
