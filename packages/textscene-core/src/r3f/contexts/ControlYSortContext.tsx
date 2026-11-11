/**
 * The link between the world walk's y-sort and the Control walk beside it. The Control walk knows
 * where each Control's canvas item sits once it has solved, and the y-sort packs the draw order of
 * every item below a `y_sort_enabled` node. Each publishes what the other reads: the transforms to
 * the sort, and the shifts the sort gives the Control subtrees back to the walk. Without a
 * provider both are empty: a Control sorts at the origin and draws in the order it was authored.
 */
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { equalTransform2D, type Transform2DColumns } from '../../godot/math/transform2d.js';
import type { PaintRange } from '../canvasPaintOrder.js';

/** Control paths to the transform of their canvas item in their parent, written only by the Control walk. */
export type ControlTransforms = ReadonlyMap<string, Transform2DColumns>;

/** Where the y-sort moved a node's draw-sequence run, written only by `YSortDispatcher`. */
export interface YSortShift {
  /** The run the sort gave the node's subtree. */
  run: PaintRange;
  /** Where the scene order put that run, which `buildSolveTree` allocated the Control subtrees from. */
  from: number;
}

/** Node paths to their shift. */
export type YSortShifts = ReadonlyMap<string, YSortShift>;

const NO_TRANSFORMS: ControlTransforms = new Map();
const NO_SHIFTS: YSortShifts = new Map();

/** Replaces the entries `owner` gave, or removes them when `entries` is null. */
type Publish<Entries> = (owner: string, entries: Entries | null) => void;

interface Publishers {
  publishTransforms: Publish<ControlTransforms>;
  publishShifts: Publish<YSortShifts>;
}

const TransformsContext = createContext<ControlTransforms>(NO_TRANSFORMS);
const ShiftsContext = createContext<YSortShifts>(NO_SHIFTS);
const PublishersContext = createContext<Publishers | null>(null);
TransformsContext.displayName = 'ControlTransformsContext';
ShiftsContext.displayName = 'YSortShiftsContext';
PublishersContext.displayName = 'ControlYSortPublishers';

function sameEntries<T>(
  a: ReadonlyMap<string, T>,
  b: ReadonlyMap<string, T>,
  equal: (x: T, y: T) => boolean
) {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    const other = b.get(key);
    if (other === undefined || !equal(value, other)) return false;
  }
  return true;
}

const sameShift = (a: YSortShift, b: YSortShift) =>
  a.from === b.from && a.run.base === b.run.base && a.run.size === b.run.size;

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

export function ControlYSortProvider({ children }: { children: ReactNode }) {
  const [transforms, publishTransforms] = useOwnedEntries(NO_TRANSFORMS, equalTransform2D);
  const [shifts, publishShifts] = useOwnedEntries(NO_SHIFTS, sameShift);
  const publishers = useMemo(
    () => ({ publishTransforms, publishShifts }),
    [publishTransforms, publishShifts]
  );

  return (
    <PublishersContext.Provider value={publishers}>
      <TransformsContext.Provider value={transforms}>
        <ShiftsContext.Provider value={shifts}>{children}</ShiftsContext.Provider>
      </TransformsContext.Provider>
    </PublishersContext.Provider>
  );
}

/** The transforms the Control walks published. */
export function useControlTransforms(): ControlTransforms {
  return useContext(TransformsContext);
}

/** The shifts the y-sorts published. */
export function useYSortShifts(): YSortShifts {
  return useContext(ShiftsContext);
}

/** The publisher of the Control walk's transforms, or null where there is no provider. */
export function usePublishControlTransforms(): Publish<ControlTransforms> | null {
  return useContext(PublishersContext)?.publishTransforms ?? null;
}

/** The publisher of the y-sort's shifts, or null where there is no provider. */
export function usePublishYSortShifts(): Publish<YSortShifts> | null {
  return useContext(PublishersContext)?.publishShifts ?? null;
}
