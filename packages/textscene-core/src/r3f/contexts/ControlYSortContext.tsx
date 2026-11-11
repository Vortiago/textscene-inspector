/**
 * The link between a y-sorted node's world walk and the Control walk beside it. The Control walk
 * knows each Control's canvas item origin once it has solved, and the world walk packs the draw
 * order of the node's children. Each publishes what the other reads: the origins to the sort, and
 * the run the sort gives a Control child back to the Control walk. Without a provider both are
 * empty, and a Control sorts at the origin 0 in the scene order it was authored.
 */
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Vector2 } from '../../godot/math/vector.js';
import type { PaintRange } from '../canvasPaintOrder.js';

/** Control paths to the origin of their canvas item in their parent, written only by the Control walk. */
export type ControlOrigins = ReadonlyMap<string, Vector2>;
/** Control paths to the draw-sequence run a y-sort gave them, written only by `YSortDispatcher`. */
export type ControlRuns = ReadonlyMap<string, PaintRange>;

const NO_ORIGINS: ControlOrigins = new Map();
const NO_RUNS: ControlRuns = new Map();

interface Publishers {
  /** Replaces every origin: the Control walk publishes its whole solve. */
  publishOrigins: (origins: ControlOrigins) => void;
  /** Replaces the runs `owner` gave, or removes them when `runs` is null. */
  publishRuns: (owner: string, runs: ControlRuns | null) => void;
}

const OriginsContext = createContext<ControlOrigins>(NO_ORIGINS);
const RunsContext = createContext<ControlRuns>(NO_RUNS);
const PublishersContext = createContext<Publishers | null>(null);
OriginsContext.displayName = 'ControlOriginsContext';
RunsContext.displayName = 'ControlRunsContext';
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

const sameOrigin = (a: Vector2, b: Vector2) => a.x === b.x && a.y === b.y;
const sameRun = (a: PaintRange, b: PaintRange) => a.base === b.base && a.size === b.size;

export function ControlYSortProvider({ children }: { children: ReactNode }) {
  const [origins, setOrigins] = useState<ControlOrigins>(NO_ORIGINS);
  const [runs, setRuns] = useState<ControlRuns>(NO_RUNS);
  /** Written only by `publishRuns`: the runs each owner gave, merged into `runs`. */
  const runsByOwner = useRef(new Map<string, ControlRuns>());

  const publishers = useMemo<Publishers>(
    () => ({
      // A walk that publishes what it already published leaves every reader as it was.
      publishOrigins: (next) => setOrigins((held) => (sameEntries(held, next, sameOrigin) ? held : next)),
      publishRuns: (owner, next) => {
        if (next) runsByOwner.current.set(owner, next);
        else runsByOwner.current.delete(owner);
        const merged = new Map<string, PaintRange>();
        for (const owned of runsByOwner.current.values())
          for (const [path, run] of owned) merged.set(path, run);
        setRuns((held) => (sameEntries(held, merged, sameRun) ? held : merged));
      },
    }),
    []
  );

  return (
    <PublishersContext.Provider value={publishers}>
      <OriginsContext.Provider value={origins}>
        <RunsContext.Provider value={runs}>{children}</RunsContext.Provider>
      </OriginsContext.Provider>
    </PublishersContext.Provider>
  );
}

/** The origins the Control walk published. */
export function useControlOrigins(): ControlOrigins {
  return useContext(OriginsContext);
}

/** The runs the y-sorts gave their Control children. */
export function useControlRuns(): ControlRuns {
  return useContext(RunsContext);
}

/** `publishOrigins` of the enclosing provider, or null where there is none. */
export function usePublishControlOrigins(): Publishers['publishOrigins'] | null {
  return useContext(PublishersContext)?.publishOrigins ?? null;
}

/** `publishRuns` of the enclosing provider, bound to the caller's own key, or null where there is none. */
export function usePublishControlRuns(owner: string): ((runs: ControlRuns | null) => void) | null {
  const publish = useContext(PublishersContext)?.publishRuns;
  return useMemo(
    () => (publish ? (runs: ControlRuns | null) => publish(owner, runs) : null),
    [publish, owner]
  );
}
