/**
 * The one y-sort of a canvas that both walks read (`canvasItemPass/ySort.ts`). The Control walk
 * publishes where each Control's canvas item sits once it has solved, a y-sorted tile layer its rows,
 * and a sort root the ys a mixer pose gives its entries. The provider sorts the shared live tree with
 * them, and every drawn item reads its run by live path. Without a provider nothing sorts here.
 */
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { equalTransform2D, type Transform2DColumns } from '../../godot/math/transform2d.js';
import type { PaintRange } from '../canvasPaintOrder.js';
import { canvasItemPass } from '../canvasItemPass/canvasItemPass.js';
import { canvasPaintPass, type CanvasItemPaint } from '../canvasItemPass/canvasItemPaint.js';
import {
  mergedSorters,
  sortedPaintOf,
  ySortedPaint,
  type ExtraSortItems,
  type SortInputs,
} from '../canvasItemPass/ySort.js';
import { useLiveScenePassSelection } from '../liveScenePass.js';
import { sameData } from '../../utils/sameData.js';
import { sameEntries } from '../../utils/sameEntries.js';
import { useByValue } from '../hooks/useByValue.js';

/** Control paths to the transform of their canvas item in their parent, written only by the Control walk. */
export type ControlTransforms = ReadonlyMap<string, Transform2DColumns>;

/**
 * Control paths to `Control::get_transform()`, the transform of the Control in its parent that the
 * canvas item snaps to whole pixels (`control.cpp:731-736`). The live scene passes compose through it,
 * as `get_global_transform()` does. Written only by the Control walk.
 */
export type ControlLocalTransforms = ControlTransforms;

const NO_TRANSFORMS: ControlTransforms = new Map();
const NO_EXTRAS: ExtraSortItems = new Map();
const NO_YS: ReadonlyMap<string, number> = new Map();
const NO_RUNS: ReadonlyMap<string, PaintRange> = new Map();
const NO_PAINTS: ReadonlyMap<string, CanvasItemPaint> = new Map();

/** Replaces the entries `owner` gave, or removes them when `entries` is null. */
type Publish<Entries> = (owner: string, entries: Entries | null) => void;

interface Publishers {
  publishTransforms: Publish<ControlTransforms>;
  publishLocalTransforms: Publish<ControlLocalTransforms>;
  publishExtras: Publish<ExtraSortItems>;
  publishLiveYs: Publish<ReadonlyMap<string, number>>;
}

const TransformsContext = createContext<ControlTransforms>(NO_TRANSFORMS);
const LocalTransformsContext = createContext<ControlLocalTransforms>(NO_TRANSFORMS);
/** The sorted runs and the tree-order paint they move, for {@link sortedPaintOf}. */
export interface SortedRunsValue {
  readonly runs: ReadonlyMap<string, PaintRange>;
  readonly paints: ReadonlyMap<string, CanvasItemPaint>;
  /** The items whose children are entries of an outer sort (`mergedSorters`), by live path. */
  readonly mergedSorters: ReadonlySet<string>;
}
const NO_PATHS: ReadonlySet<string> = new Set();
const SortedRunsContext = createContext<SortedRunsValue>({
  runs: NO_RUNS,
  paints: NO_PAINTS,
  mergedSorters: NO_PATHS,
});
const PublishersContext = createContext<Publishers | null>(null);
TransformsContext.displayName = 'ControlTransformsContext';
LocalTransformsContext.displayName = 'ControlLocalTransformsContext';
SortedRunsContext.displayName = 'YSortRunsContext';
PublishersContext.displayName = 'ControlYSortPublishers';

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((path) => b.has(path));

/**
 * The entries of every owner, merged, with the publisher that sets one owner's share. A publish
 * that changes nothing leaves the merged map as it was, so no reader re-renders.
 */
function useOwnedEntries<T>(none: ReadonlyMap<string, T>, equal: (x: T, y: T) => boolean) {
  const [merged, setMerged] = useState(none);
  /** Written only by the publisher: the entries each owner gave. */
  const byOwner = useRef(new Map<string, ReadonlyMap<string, T>>());
  const publish = useMemo<Publish<ReadonlyMap<string, T>>>(
    () => (owner, entries) => {
      if (entries) byOwner.current.set(owner, entries);
      else byOwner.current.delete(owner);
      const next = new Map<string, T>();
      for (const owned of byOwner.current.values()) for (const [path, entry] of owned) next.set(path, entry);
      setMerged((held) => (sameEntries(held, next, equal) ? held : next));
    },
    [equal]
  );
  return [merged, publish] as const;
}

export function YSortProvider({ children }: { children: ReactNode }) {
  const [transforms, publishTransforms] = useOwnedEntries(NO_TRANSFORMS, equalTransform2D);
  const [localTransforms, publishLocalTransforms] = useOwnedEntries(NO_TRANSFORMS, equalTransform2D);
  const [extras, publishExtras] = useOwnedEntries(NO_EXTRAS, sameData);
  const [liveYs, publishLiveYs] = useOwnedEntries(NO_YS, Object.is);
  const publishers = useMemo(
    () => ({ publishTransforms, publishLocalTransforms, publishExtras, publishLiveYs }),
    [publishTransforms, publishLocalTransforms, publishExtras, publishLiveYs]
  );

  return (
    <PublishersContext.Provider value={publishers}>
      <TransformsContext.Provider value={transforms}>
        <LocalTransformsContext.Provider value={localTransforms}>
          <SortedRuns origins={transforms} extras={extras} liveYs={liveYs}>
            {children}
          </SortedRuns>
        </LocalTransformsContext.Provider>
      </TransformsContext.Provider>
    </PublishersContext.Provider>
  );
}

/**
 * The sort of the shared live tree over `inputs`. A component of its own below the local transforms,
 * so it reads the tree every drawn node reads, which composes through those transforms.
 */
function SortedRuns({ origins, extras, liveYs, children }: SortInputs & { children: ReactNode }) {
  const results = useLiveScenePassSelection(canvasItemPass, wholeResults, Object.is);
  const paints = useLiveScenePassSelection(canvasPaintPass, wholeResults, Object.is);
  const merged = useMemo(() => (results ? mergedSorters(results) : NO_PATHS), [results]);
  /** Written only by the memo below: the last sort, which a frame with no pass results keeps. */
  const held = useRef<SortedRunsValue>({ runs: NO_RUNS, paints: NO_PAINTS, mergedSorters: NO_PATHS });
  const sorted = useMemo(() => {
    if (!results || !paints) return held.current;
    const runs = ySortedPaint(results, paints, { origins, extras, liveYs });
    // An unchanged sort keeps its identity, so a pose that moves no entry past another re-renders no item.
    const isUnchanged =
      held.current.paints === paints &&
      sameEntries(held.current.runs, runs, sameData) &&
      sameSet(held.current.mergedSorters, merged);
    if (isUnchanged) return held.current;
    held.current = { runs, paints, mergedSorters: merged };
    return held.current;
  }, [results, paints, merged, origins, extras, liveYs]);
  return <SortedRunsContext.Provider value={sorted}>{children}</SortedRunsContext.Provider>;
}

function wholeResults<Result>(results: ReadonlyMap<string, Result>): ReadonlyMap<string, Result> {
  return results;
}

/** The paint of the item at `path` after the sorts, from the paint the pass gives it in tree order. */
export function useSortedPaint(path: string | null, paint: CanvasItemPaint): CanvasItemPaint {
  const { runs, paints } = useContext(SortedRunsContext);
  return useMemo(
    () => (path === null ? paint : sortedPaintOf(path, paint, runs, paints)),
    [path, paint, runs, paints]
  );
}

/** The sorted runs with the tree-order paint they move, for a walk that places its own nodes. */
export function useSortedRunsAndPaints(): SortedRunsValue {
  return useContext(SortedRunsContext);
}

/**
 * The transforms the Control walks published for the Controls below `path`, or none for a null `path`. The map keeps its
 * identity while those entries stay as they are, so a Control moving under another sort leaves
 * this sort's memos alone.
 */
export function useControlTransformsUnder(path: string | null): ControlTransforms {
  const published = useContext(TransformsContext);
  const scoped = new Map<string, Transform2DColumns>();
  // A null path reads nothing, so a sort with no Control below skips the scan.
  if (path !== null) {
    const prefix = `${path}/`;
    for (const [key, transform] of published) if (key.startsWith(prefix)) scoped.set(key, transform);
  }
  return useByValue<ControlTransforms>(scoped, sameTransforms);
}

const sameTransforms = (a: ControlTransforms, b: ControlTransforms) => sameEntries(a, b, equalTransform2D);

/** The transform the Control walks published for the Control at `path`, or null before they solve it. */
export function useControlTransform(path: string): Transform2DColumns | null {
  return useContext(TransformsContext).get(path) ?? null;
}

/** The local transforms the Control walks published, empty where there is no provider or no solve yet. */
export function useControlLocalTransforms(): ControlLocalTransforms {
  return useContext(LocalTransformsContext);
}

/** The publisher of the Control walk's transforms, or null where there is no provider. */
export function usePublishControlTransforms(): Publish<ControlTransforms> | null {
  return useContext(PublishersContext)?.publishTransforms ?? null;
}

/** The publisher of the Control walk's local transforms, or null where there is no provider. */
export function usePublishControlLocalTransforms(): Publish<ControlLocalTransforms> | null {
  return useContext(PublishersContext)?.publishLocalTransforms ?? null;
}

/** The publisher of the extra pieces a node sorts, or null where there is no provider. */
export function usePublishSortExtras(): Publish<ExtraSortItems> | null {
  return useContext(PublishersContext)?.publishExtras ?? null;
}

/** The publisher of the ys mixer poses give, or null where there is no provider. */
export function usePublishLiveSortYs(): Publish<ReadonlyMap<string, number>> | null {
  return useContext(PublishersContext)?.publishLiveYs ?? null;
}
